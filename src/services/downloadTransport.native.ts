import {
  File,
  FileMode,
  Directory,
  Paths,
  DownloadTask,
  type DownloadPauseState,
} from "expo-file-system";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import * as records from "../storage/records";
import { apiUrl } from "./api";
import { hasIndexPart } from "../storage/bank";
import { checkCancelled } from "../domain/cancellation";
import type { Manifest, DownloadPart } from "./library";
type Transfer = {
  task?: DownloadTask;
  promise: Promise<File>;
  bytes: number;
  file: File;
  failed: boolean;
  pausing?: Promise<void>;
};
const transfers = new Map<string, Transfer>(),
  listeners = new Set<() => void>();
const key = (owner: string, hash: string) => owner + ":" + hash;
let lastProgress = 0;
function notify() {
  if (Date.now() - lastProgress < 120) return;
  lastProgress = Date.now();
  for (const fn of listeners) fn();
}
const starting = new Map<string, Promise<Transfer>>();
async function transfer(
  owner: string,
  bundle: string,
  part: DownloadPart,
): Promise<Transfer> {
  const id = key(owner, part.hash),
    pending = starting.get(id);
  if (pending) return pending;
  const work = createTransfer(owner, bundle, part).finally(() =>
    starting.delete(id),
  );
  starting.set(id, work);
  return work;
}
async function createTransfer(
  owner: string,
  bundle: string,
  part: DownloadPart,
): Promise<Transfer> {
  const id = key(owner, part.hash),
    old = transfers.get(id);
  if (old && !old.failed) return old;
  old?.task?.release();
  const folder = new Directory(
    Paths.cache,
    "pastq-downloads",
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner),
  );
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, part.hash + ".json"),
    url = apiUrl(
      "/api/library/bundles/" +
        encodeURIComponent(bundle) +
        "/parts/" +
        part.hash,
    );
  if (file.exists && file.size === part.bytes) {
    const done = {
      file,
      bytes: part.bytes,
      promise: Promise.resolve(file),
      failed: false,
    };
    transfers.set(id, done);
    return done;
  }
  const state = await records.read<DownloadPauseState>(
    owner,
    "download-resume",
    part.hash,
  );
  const range = await records.read<{ offset: number }>(
    owner,
    "download-range",
    part.hash,
  );
  const tail = new File(folder, part.hash + ".tail");
  const pausedValid =
    !!state?.resumeData &&
    state.url === url &&
    (state.fileUri === file.uri ||
      (state.fileUri === tail.uri &&
        range?.offset === (file.exists ? file.size : 0))) &&
    (Platform.OS === "ios" || new File(state.fileUri).exists);
  // An interrupted Android stream leaves real bytes on disk. Fold them into the verified prefix.
  if (!pausedValid && tail.exists) {
    if (tail.size === part.bytes) {
      if (file.exists) file.delete();
      await tail.move(file);
    } else if (
      range &&
      range.offset === (file.exists ? file.size : 0) &&
      tail.size <= part.bytes - range.offset
    ) {
      appendBytes(file, tail);
      tail.delete();
    } else tail.delete();
  }
  if (file.exists && file.size > part.bytes) file.delete();
  const offset = file.exists ? file.size : 0;
  if (offset === part.bytes) {
    const done = {
      file,
      bytes: part.bytes,
      promise: Promise.resolve(file),
      failed: false,
    };
    transfers.set(id, done);
    return done;
  }
  const options = {
    sessionType: "background" as const,
    headers: pausedValid
      ? state!.headers || { "Accept-Encoding": "identity" }
      : {
          "Accept-Encoding": "identity",
          ...(offset ? { Range: "bytes=" + offset + "-" } : {}),
        },
    onProgress: (p: { bytesWritten: number }) => {
      const current = transfers.get(id);
      if (current) {
        current.bytes = Math.max(
          0,
          Math.min(part.bytes, offset + p.bytesWritten),
        );
        notify();
      }
    },
  };
  let task: DownloadTask;
  if (pausedValid) task = DownloadTask.fromSavable(state!, options);
  else {
    if (offset)
      await records.write(owner, "download-range", part.hash, { offset });
    task = File.createDownloadTask(url, offset ? tail : file, options);
  }
  const t: Transfer = {
    file,
    task,
    bytes: offset,
    failed: false,
    promise: Promise.resolve(file),
  };
  transfers.set(id, t);
  t.promise = (
    task.state === "paused" ? task.resumeAsync() : task.downloadAsync()
  )
    .then(async (result) => {
      if (!result) throw Error("Download paused.");
      if (result.uri !== file.uri) {
        // Some proxies ignore Range and return the complete resource; accept it only as a full file.
        if (result.size === part.bytes) {
          if (file.exists) file.delete();
          await result.move(file);
        } else if (offset + result.size === part.bytes) {
          appendBytes(file, result);
          result.delete();
        } else throw Error("Download interrupted. Resume to continue.");
      }
      await records.remove(owner, "download-resume", part.hash);
      await records.remove(owner, "download-range", part.hash);
      t.bytes = part.bytes;
      notify();
      return file;
    })
    .catch(async (error) => {
      t.failed = true;
      // Keep disk prefixes and pause data. A retry never discards other completed parts.
      if (task.state === "paused") {
        const saved = task.savable();
        if (saved.resumeData)
          await records.write(owner, "download-resume", part.hash, saved);
      } else await records.remove(owner, "download-resume", part.hash);
      throw error;
    });
  // Files are consumed one at a time. Later native transfers can finish while JS is suspended.
  void t.promise.catch(() => {});
  return t;
}
/** Enqueue native transfers before waiting for any one file. Background session owns network IO. */
export async function prepareParts(
  owner: string,
  value: Manifest,
  selected: string[],
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
) {
  const parts = value.parts.filter((p) => selected.includes(p.hash)),
    cached = new Set<string>();
  const report = () =>
    onProgress?.(
      parts.reduce(
        (n, p) =>
          n +
          (cached.has(p.hash)
            ? p.bytes
            : transfers.get(key(owner, p.hash))?.bytes || 0),
        0,
      ),
      parts.reduce((n, p) => n + p.bytes, 0),
    );
  if (onProgress) listeners.add(report);
  const pause = () => {
    void pauseParts(owner, value);
  };
  signal.addEventListener("abort", pause, { once: true });
  try {
    for (const p of parts) {
      checkCancelled(signal);
      if (
        (await hasIndexPart(
          owner,
          value.bundle.id,
          value.version,
          p.hash,
          p.count,
        )) ||
        (await records.read(
          owner,
          "download-part",
          value.bundle.id + ":" + p.hash,
        ))
      )
        cached.add(p.hash);
      else await transfer(owner, value.bundle.id, p);
    }
    report();
  } catch (e) {
    listeners.delete(report);
    signal.removeEventListener("abort", pause);
    await pauseParts(owner, value);
    throw e;
  }
  return () => {
    listeners.delete(report);
    signal.removeEventListener("abort", pause);
  };
}
export async function readPart(
  owner: string,
  value: Manifest,
  part: DownloadPart,
  signal: AbortSignal,
  onProgress: (bytes: number) => void,
): Promise<string> {
  checkCancelled(signal);
  const t = await transfer(owner, value.bundle.id, part);
  const report = () => onProgress(t.bytes);
  listeners.add(report);
  let pausing: Promise<void> | undefined;
  const pause = () => {
    pausing = pauseParts(owner, value);
  };
  signal.addEventListener("abort", pause, { once: true });
  try {
    checkCancelled(signal);
    const file = await t.promise;
    checkCancelled(signal);
    const text = await file.text();
    if (
      (await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        text,
      )) !== part.hash
    ) {
      await forgetParts(owner, value, [part.hash]);
      throw Error("A download part failed verification. Resume to retry.");
    }
    return text;
  } finally {
    signal.removeEventListener("abort", pause);
    listeners.delete(report);
    await pausing;
  }
}
async function pauseTransfer(owner: string, hash: string, t: Transfer) {
  if (t.pausing) return t.pausing;
  if (!t.task || t.task.state !== "active") return;
  const task = t.task;
  t.pausing = (async () => {
    try {
      await task.pauseAsync();
      const state = task.savable();
      if (state.resumeData)
        await records.write(owner, "download-resume", hash, state);
    } catch {}
  })();
  await t.pausing;
}
export async function pauseParts(owner: string, value: Manifest) {
  await Promise.all(
    value.parts.map((p) => {
      const t = transfers.get(key(owner, p.hash));
      return t ? pauseTransfer(owner, p.hash, t) : undefined;
    }),
  );
}
function appendBytes(destination: File, source: File) {
  if (!destination.exists) destination.create();
  const input = source.open(FileMode.ReadOnly),
    output = destination.open(FileMode.Append);
  try {
    for (let left = source.size; left > 0;) {
      const bytes = input.readBytes(Math.min(65536, left));
      if (!bytes.length) throw Error("Incomplete download file.");
      output.writeBytes(bytes);
      left -= bytes.length;
    }
  } finally {
    input.close();
    output.close();
  }
}
export async function forgetParts(
  owner: string,
  value: Manifest,
  selected: string[],
) {
  for (const p of value.parts.filter((p) => selected.includes(p.hash))) {
    const id = key(owner, p.hash),
      t = transfers.get(id);
    if (t?.task?.state === "active") continue;
    if (t?.file.exists) t.file.delete();
    if (t?.file) {
      const tail = new File(t.file.parentDirectory, p.hash + ".tail");
      if (tail.exists) tail.delete();
    }
    t?.task?.release();
    transfers.delete(id);
    await records.remove(owner, "download-resume", p.hash);
    await records.remove(owner, "download-range", p.hash);
  }
}

export async function clearTransferCache(owner: string) {
  const owned = [...transfers.entries()].filter(([id]) =>
    id.startsWith(owner + ":"),
  );
  for (const [id, t] of owned) {
    await pauseTransfer(owner, id.slice(owner.length + 1), t);
    t.task?.release();
  }
  for (const [id] of owned) transfers.delete(id);
  const folder = new Directory(
    Paths.cache,
    "pastq-downloads",
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner),
  );
  if (folder.exists) folder.delete();
  await records.commit(owner, [
    { kind: "download-resume", remove: true },
    { kind: "download-range", remove: true },
    { kind: "download-part", remove: true },
  ]);
}
