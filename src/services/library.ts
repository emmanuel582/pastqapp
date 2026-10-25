import {
  checkCancelled,
  abortTransfer,
  cancellationReason,
} from "../domain/cancellation";
import { supabase } from "./auth";
import {
  supportsIndex,
  indexPart,
  commitIndex,
  readIndex,
  hasIndexPart,
} from "../storage/bank";
import { normalizeBundle } from "../domain/contracts";
import { preparePrivateMedia } from "./privateMedia";
import * as Crypto from "expo-crypto";
import * as records from "../storage/records";
import { request } from "./api";
import {
  prepareParts,
  readPart,
  forgetParts,
  pauseParts,
} from "./downloadTransport";
import type { Bundle, Catalog, Question, Asset } from "../domain/types";
export async function prepareDownload(
  owner: string,
  value: Manifest,
  selected: string[],
  signal: AbortSignal,
) {
  checkCancelled(signal);
  const running = runningDownloads.get(
    JSON.stringify([owner, value.bundle.id]),
  );
  if (
    running &&
    running.selection !== JSON.stringify([value.version, [...selected].sort()])
  )
    throw Error(
      "This material is already downloading. Pause it before changing subjects.",
    );
  await records.write(owner, "download-plan", value.bundle.id, {
    manifest: value,
    selected,
  });
  return prepareParts(owner, value, selected, signal);
}
export type DownloadPart = {
  hash: string;
  subject: string;
  year: string;
  paper: string;
  count: number;
  bytes: number;
  offset: number;
};
export type Manifest = {
  version: string;
  bundle: Bundle;
  parts: DownloadPart[];
  totalQuestions: number;
  totalBytes: number;
};
export const formatBytes = (bytes: number) =>
  bytes <= 0
    ? "0 B"
    : bytes < 1048576
      ? Math.max(1, Math.round(bytes / 1024)) + " KB"
      : (bytes / 1048576).toFixed(1) + " MB";
export async function catalog(signal?: AbortSignal) {
  return request<Catalog>("/api/library/catalog", { signal });
}
export async function materials(signal?: AbortSignal) {
  const data = await request<{ bundles?: Bundle[]; materials?: Bundle[] }>(
    "/api/library/bundles",
    { signal },
  );
  return (data.bundles || data.materials || []).map(normalizeBundle);
}
export const savedBundles = (owner: string) =>
  records.list<Bundle>(owner, "bundle-meta");
export async function saveBundle(owner: string, input: Bundle) {
  const bundle = normalizeBundle(await preparePrivateMedia(owner, input));
  if (
    !bundle.id ||
    !Array.isArray(bundle.questions) ||
    !bundle.questions.length
  )
    throw new Error(
      "This download is incomplete. Your previous saved copy is unchanged.",
    );
  const { questions, assets, ...metadata } = bundle;
  await records.restore(owner, [
    { kind: "bundle", id: bundle.id, value: bundle },
    {
      kind: "bundle-meta",
      id: bundle.id,
      value: { ...metadata, question_count: questions.length, questions: [] },
    },
  ]);
  return bundle;
}
export async function getBundle(owner: string, id: string) {
  const indexed = await readIndex(owner, id);
  if (indexed) return indexed;
  const saved = await records.read<Bundle>(owner, "bundle", id);
  if (saved) return saved;
  const remote = await records.read(owner, "remote-material", id);
  const raw = await request<Bundle>(
    (remote ? "/api/vision/materials/" : "/api/library/bundles/") +
      encodeURIComponent(id),
    remote ? { owner } : {},
    !!remote,
  );
  const bundle = normalizeBundle(raw);
  if (remote) return saveBundle(owner, { ...bundle, ownerId: owner });
  return bundle;
}
export async function manifest(id: string, signal?: AbortSignal) {
  const value = await request<Manifest>(
    "/api/library/bundles/" + encodeURIComponent(id) + "/manifest",
    { signal },
  );
  if (
    !Array.isArray(value.parts) ||
    !value.parts.length ||
    value.bundle?.id !== id ||
    value.parts.some(
      (part) =>
        !/^[a-f0-9]{64}$/.test(part.hash) ||
        !Number.isSafeInteger(part.count) ||
        part.count <= 0 ||
        !Number.isSafeInteger(part.bytes) ||
        part.bytes <= 0,
    ) ||
    value.parts.reduce((n, p) => n + p.count, 0) !== value.totalQuestions ||
    value.parts.reduce((n, p) => n + p.bytes, 0) !== value.totalBytes
  )
    throw new Error("Invalid download details.");
  return value;
}
type RunningDownload = {
  selection: string;
  controller: AbortController;
  promise: Promise<Bundle>;
  listeners: Set<(done: number, total: number) => void>;
  progress: [number, number];
};
const runningDownloads = new Map<string, RunningDownload>();
export async function download(
  owner: string,
  value: Manifest,
  selected: string[],
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
) {
  checkCancelled(signal);
  const key = JSON.stringify([owner, value.bundle.id]),
    selection = JSON.stringify([value.version, [...selected].sort()]);
  let run = runningDownloads.get(key);
  if (run && run.selection !== selection)
    throw Error(
      "This material is already downloading. Pause it before changing subjects.",
    );
  if (!run) {
    const controller = new AbortController();
    run = {
      selection,
      controller,
      promise: Promise.resolve(value.bundle),
      listeners: new Set(),
      progress: [0, 0],
    };
    const current = run;
    runningDownloads.set(key, current);
    current.promise = performDownload(
      owner,
      value,
      selected,
      controller.signal,
      (done, total) => {
        current.progress = [Math.max(current.progress[0], done), total];
        for (const fn of current.listeners) fn(...current.progress);
      },
    ).finally(() => runningDownloads.delete(key));
  }
  const current = run;
  current.listeners.add(onProgress);
  onProgress(...current.progress);
  const abort = () =>
    abortTransfer(current.controller, cancellationReason(signal));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    return await current.promise;
  } finally {
    current.listeners.delete(onProgress);
    signal.removeEventListener("abort", abort);
  }
}
async function performDownload(
  owner: string,
  value: Manifest,
  selected: string[],
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
) {
  const parts = value.parts.filter((part) => selected.includes(part.hash));
  if (!parts.length) throw new Error("Choose a subject or paper.");
  await records.write(owner, "download-plan", value.bundle.id, {
    manifest: value,
    selected,
  });
  const release = await prepareParts(
    owner,
    value,
    selected,
    signal,
    onProgress,
  );
  try {
    let done = 0;
    const total = parts.reduce((n, p) => n + p.bytes, 0);
    const questions: Question[] = [],
      assets: Record<string, Asset> = {};
    for (const part of parts) {
      checkCancelled(signal);
      if (
        supportsIndex &&
        (await hasIndexPart(
          owner,
          value.bundle.id,
          value.version,
          part.hash,
          part.count,
        ))
      ) {
        done += part.bytes;
        onProgress(done, total);
        continue;
      }
      const id = value.bundle.id + ":" + part.hash;
      let text = await records.read<string>(owner, "download-part", id);
      if (
        !text ||
        (await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          text,
        )) !== part.hash
      ) {
        text = await readPart(owner, value, part, signal, (received) =>
          onProgress(Math.min(total, done + received), total),
        );
        if (
          (await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            text,
          )) !== part.hash
        )
          throw new Error(
            "A download part failed verification. Resume to retry.",
          );
        const payload = JSON.parse(text);
        if (payload.questions?.length !== part.count)
          throw new Error("A download part is incomplete.");
        await records.write(owner, "download-part", id, text);
      }
      const payload = JSON.parse(text);
      if (supportsIndex)
        await indexPart(
          owner,
          value.bundle,
          value.version,
          part,
          payload,
          parts.slice(0, parts.indexOf(part)).reduce((n, p) => n + p.count, 0),
        );
      else {
        questions.push(...payload.questions);
        Object.assign(assets, payload.assets);
      }
      done += part.bytes;
      onProgress(done, total);
    }
    checkCancelled(signal);
    if (supportsIndex) {
      const indexed = await commitIndex(
        owner,
        value.bundle,
        value.version,
        selected,
        parts.reduce((n, p) => n + p.count, 0),
        done,
        parts.length !== value.parts.length,
        parts,
      );
      for (const part of parts)
        await records.remove(
          owner,
          "download-part",
          value.bundle.id + ":" + part.hash,
        );
      await forgetParts(owner, value, selected);
      await records.remove(owner, "download-plan", value.bundle.id);
      return indexed;
    }
    const bundle = {
      ...value.bundle,
      questions,
      assets,
      updatedAt: value.version,
      downloadedParts: selected,
      downloadedSelection: parts,
      partialDownload: parts.length !== value.parts.length,
      downloadBytes: done,
    };
    const result = await saveBundle(owner, bundle);
    await forgetParts(owner, value, selected);
    await records.remove(owner, "download-plan", value.bundle.id);
    return result;
  } finally {
    if (signal.aborted) {
      await pauseParts(owner, value);
      await records.write(owner, "download-plan", value.bundle.id, {
        manifest: value,
        selected,
        paused:
          cancellationReason(signal) !== "background-expired" &&
          cancellationReason(signal) !== "account-changed",
      });
    }
    release();
  }
}

export async function savedUploads(owner: string, signal?: AbortSignal) {
  const rows: Bundle[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    if ((await supabase?.auth.getSession())?.data.session?.user.id !== owner)
      throw new Error("Your account changed. Reopen your library.");
    const value: { materials: Bundle[]; nextOffset?: number } = await request(
      "/api/vision/materials?offset=" + offset + "&limit=100",
      { signal, owner },
      true,
    );
    if ((await supabase?.auth.getSession())?.data.session?.user.id !== owner)
      throw new Error("Your account changed. Reopen your library.");
    for (const raw of value.materials || []) {
      const b = normalizeBundle({ ...raw, ownerId: owner });
      rows.push(b);
      await records.write(owner, "remote-material", b.id, b);
    }
    const next = value.nextOffset;
    offset = typeof next === "number" && next > offset ? next : null;
  }
  return rows;
}
