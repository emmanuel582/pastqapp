import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { supabase } from "./auth";
import * as records from "../storage/records";
import { uploadMaterial, type UploadDraft } from "./uploads";
import { download, type Manifest } from "./library";
const TASK = "focalpoint-transfer-recovery";
let running: Promise<void> | undefined;
async function recover(signal: AbortSignal) {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session) return;
  const owner = session.user.id,
    draft = await records.read<UploadDraft>(owner, "upload", "draft");
  if (draft?.started && draft.files.length) {
    const id = await uploadMaterial(
      draft.files,
      draft.name,
      () => {},
      draft.sessionId,
      async (sessionId) => {
        await records.write(owner, "upload", "draft", { ...draft, sessionId });
      },
      signal,
    );
    await records.write(owner, "processing", "current", id);
    await records.remove(owner, "upload", "draft");
  }
  const plans = await records.list<{
    manifest: Manifest;
    selected: string[];
    paused?: boolean;
  }>(owner, "download-plan");
  for (const plan of plans) {
    if (signal.aborted) break;
    if (plan.paused) continue;
    await download(owner, plan.manifest, plan.selected, signal, () => {});
  }
}
export function resumePendingTransfers(signal: AbortSignal) {
  if (running) return running;
  running = recover(signal).finally(() => {
    running = undefined;
  });
  return running;
}
TaskManager.defineTask(TASK, async () => {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort("background-expired"), 50000),
    expiry = BackgroundTask.addExpirationListener(() => controller.abort());
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
