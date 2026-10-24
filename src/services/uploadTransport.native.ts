import { File, Directory, Paths, UploadType } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { apiUrl, request, json } from "./api";
import { supabase } from "./auth";
import { checkCancelled } from "../domain/cancellation";
import type { UploadFile } from "./uploads";
const PART_BYTES = 4 * 1048576;
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const hash = (bytes: Uint8Array<ArrayBuffer>) =>
  Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes).then(hex);
async function folder(owner: string) {
  const dir = new Directory(
    Paths.document,
    "focalpoint-uploads",
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner),
  );
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}
/** Picker/cache URIs can disappear after an OS restart. Keep an account-scoped durable copy. */
export async function stageUploadFiles(
  owner: string,
  files: UploadFile[],
): Promise<UploadFile[]> {
  const dir = await folder(owner),
    result: UploadFile[] = [];
  for (const source of files) {
    const file = new File(source.uri);
    if (!file.exists)
      throw Error("This file is no longer on your phone. Choose it again.");
    if (file.size <= 0 || file.size > 200 * 1048576)
      throw Error("Choose a non-empty file below 200 MB.");
    if (source.uri.startsWith(dir.uri.replace(/\/$/, "") + "/")) {
      result.push({ ...source, size: file.size });
      continue;
    }
    const copy = new File(
      dir,
      Crypto.randomUUID() + "." + (source.name.split(".").pop() || "bin"),
    );
    await file.copy(copy);
    result.push({ ...source, uri: copy.uri, size: copy.size, file: undefined });
  }
  return result;
}
type PlanFile = { name: string; size: number; hashes: string[] };
type State = {
  files: PlanFile[];
  received: number[][];
  status: string;
  error?: string;
};
/** Each native task is a retry-safe, checksummed part. The VPS starts processing the last part itself. */
type Progress = (done: number, total: number, label: string) => void;
const active = new Map<
  string,
  {
    promise: Promise<void>;
    listeners: Set<Progress>;
    last?: [number, number, string];
  }
>();
export function transferUpload(
  id: string,
  files: UploadFile[],
  onProgress: Progress,
  signal?: AbortSignal,
): Promise<void> {
  let current = active.get(id);
  if (!current) {
    const run: {
      promise: Promise<void>;
      listeners: Set<Progress>;
      last?: [number, number, string];
    } = { promise: Promise.resolve(), listeners: new Set() };
    active.set(id, run);
    run.promise = runTransfer(
      id,
      files,
      (...p) => {
        run.last = p;
        for (const listener of run.listeners) listener(...p);
      },
      signal,
    ).finally(() => active.delete(id));
    current = run;
  }
  current.listeners.add(onProgress);
  if (current.last) onProgress(...current.last);
  const run = current;
  return run.promise.finally(() => run.listeners.delete(onProgress));
}
async function runTransfer(
  id: string,
  files: UploadFile[],
  onProgress: Progress,
  external?: AbortSignal,
) {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session) throw Error("Sign in to continue.");
  const controller = new AbortController(),
    abort = () => controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  if (external?.aborted) abort();
  const signal = controller.signal;
  const sub = supabase!.auth.onAuthStateChange((_event, current) => {
    if (current?.user.id !== session.user.id) abort();
  });
  try {
    const dir = new Directory(await folder(session.user.id), id);
    dir.create({ intermediates: true, idempotent: true });
    const plans: PlanFile[] = [],
      chunks: { file: File; f: number; p: number; bytes: number }[] = [];
    let total = 0;
    for (let f = 0; f < files.length; f++) {
      const source = new File(files[f].uri),
        handle = source.open(),
        hashes: string[] = [];
      try {
        for (
          let p = 0, offset = 0;
          offset < source.size;
          p++, offset += PART_BYTES
        ) {
          checkCancelled(signal);
          const bytes = handle.readBytes(
            Math.min(PART_BYTES, source.size - offset),
          );
          const digest = await hash(bytes),
            part = new File(dir, `${f}-${p}-${digest}.part`);
          if (!part.exists) part.write(bytes);
          hashes.push(digest);
          chunks.push({ file: part, f, p, bytes: bytes.byteLength });
          onProgress(offset, source.size, "Preparing " + files[f].name);
        }
      } finally {
        handle.close();
      }
      plans.push({ name: files[f].name, size: source.size, hashes });
      total += source.size;
    }
    const state = await request<State>(
      "/api/transfers/" + id,
      { ...json("POST", { files: plans }), signal },
      true,
    );
    const already = (c: (typeof chunks)[number]) =>
      state.received[c.f]?.includes(c.p);
    const progress = new Map(
      chunks.map((c) => [c.file.uri, already(c) ? c.bytes : 0]),
    );
    const report = () =>
      onProgress(
        [...progress.values()].reduce((a, b) => a + b, 0),
        total,
        "Uploading material",
      );
    report();
    // Enqueue native background tasks before awaiting results. iOS owns the network while JS sleeps.
    const tasks = chunks
      .filter((c) => !already(c))
      .map((c) => {
        const task = c.file.createUploadTask(
          apiUrl(`/api/transfers/${id}/${c.f}/${c.p}`),
          {
            httpMethod: "PUT",
            uploadType: UploadType.BINARY_CONTENT,
            sessionType: "background",
            headers: {
              Authorization: "Bearer " + session.access_token,
              "Content-Type": "application/octet-stream",
            },
            signal,
            onProgress: ({ bytesSent }) => {
              progress.set(c.file.uri, Math.min(c.bytes, bytesSent));
              report();
            },
          },
        );
        const run = task
          .uploadAsync()
          .then(async (result) => {
            if (result.status === 401) {
              const current = (await supabase?.auth.getSession())?.data.session;
              if (current?.user.id !== session.user.id)
                throw Error("Your account changed. Sign in again.");
              const refreshed = await supabase!.auth.refreshSession();
              if (
                refreshed.error ||
                refreshed.data.session?.user.id !== session.user.id
              )
                throw Error("Sign in again to resume this upload.");
              const retry = c.file.createUploadTask(
                apiUrl(`/api/transfers/${id}/${c.f}/${c.p}`),
                {
                  httpMethod: "PUT",
                  sessionType: "background",
                  headers: {
                    Authorization:
                      "Bearer " + refreshed.data.session.access_token,
                    "Content-Type": "application/octet-stream",
                  },
                  signal,
                },
              );
              try {
                return await retry.uploadAsync();
              } finally {
                retry.release();
              }
            }
            return result;
          })
          .then((result) => {
            if (result.status < 200 || result.status >= 300) {
              let message =
                "Upload paused. Retry to continue from your saved parts.";
              try {
                const v = JSON.parse(result.body);
                if (typeof v.error === "string") message = v.error;
              } catch {}
              throw Error(message);
            }
            progress.set(c.file.uri, c.bytes);
            report();
          })
          .finally(() => task.release());
        // A later task may reject while an earlier task is still sending.
        void run.catch(() => {});
        return run;
      });
    const results = await Promise.allSettled(tasks),
      failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    if (
      (await supabase?.auth.getSession())?.data.session?.user.id !==
      session.user.id
    )
      throw Error("Your account changed. Reopen your upload.");
    if (dir.exists) dir.delete();
    // Originals stay until all parts are acknowledged, then the VPS owns the material.
    for (const file of files) {
      const saved = new File(file.uri);
      if (
        saved.exists &&
        file.uri.startsWith(
          (await folder(session.user.id)).uri.replace(/\/$/, "") + "/",
        )
      )
        saved.delete();
    }
    onProgress(total, total, "Material uploaded");
  } finally {
    sub.data.subscription.unsubscribe();
    external?.removeEventListener("abort", abort);
  }
}
