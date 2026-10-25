import { rememberPendingUpload } from "./uploadHistory";
import { abortTransfer } from "../domain/cancellation";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { supabase } from "./auth";
import * as records from "../storage/records";
import { uploadMaterial, type UploadDraft } from "./uploads";
import { download, type Manifest } from "./library";
const TASK = "focalpoint-transfer-recovery";
const running = new Map<string, Promise<void>>();
async function recover(owner: string, signal: AbortSignal) {
  let failure: unknown;
  const draft = await records.read<UploadDraft>(owner, "upload", "draft");
  if (draft?.started && draft.files.length) {
    let persisted = draft;
    try {
      const id = await uploadMaterial(
        draft.files,
        draft.name,
        () => {},
        draft.sessionId,
        async (sessionId) => {
          const next = { ...draft, sessionId };
          await records.compareAndSwap(
            owner,
            "upload",
            "draft",
            persisted,
            next,
          );
          await rememberPendingUpload(owner, sessionId, draft.name);
          persisted = next;
        },
        signal,
      );
      if (
        await records.compareAndSwap(owner, "upload", "draft", persisted, null)
      ) {
        await records.write(owner, "processing", "current", id);
        await rememberPendingUpload(owner, id, draft.name, "processing");
      }
    } catch (error) {
      failure = error;
    }
  }
  const plans = await records.list<{
    manifest: Manifest;
    selected: string[];
    paused?: boolean;
  }>(owner, "download-plan");
  for (const plan of plans) {
    if (signal.aborted) break;
    if (plan.paused) continue;
    if ((await supabase?.auth.getSession())?.data.session?.user.id !== owner)
      break;
    try {
      await download(owner, plan.manifest, plan.selected, signal, () => {});
    } catch (error) {
      failure = error;
    }
  }
  if (signal.aborted) throw Error("Transfer recovery paused.");
  if (failure) throw failure;
}
export async function resumePendingTransfers(signal: AbortSignal) {
  const owner = (await supabase?.auth.getSession())?.data.session?.user.id;
  if (!owner) return;
  const existing = running.get(owner);
  if (existing) return existing;
  const work = recover(owner, signal).finally(() => running.delete(owner));
  running.set(owner, work);
  return work;
}
TaskManager.defineTask(TASK, async () => {
  const controller = new AbortController(),
    expire = () => abortTransfer(controller, "background-expired");
  const timer = setTimeout(expire, 50000),
    expiry = BackgroundTask.addExpirationListener(expire);
  try {
    await resumePendingTransfers(controller.signal);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  } finally {
    clearTimeout(timer);
    expiry.remove();
  }
});
export async function registerTransferRecovery() {
  if (
    (await BackgroundTask.getStatusAsync()) ===
    BackgroundTask.BackgroundTaskStatus.Available
  )
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
