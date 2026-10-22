import { supabase } from "./auth";
import {
  supportsIndex,
  indexPart,
  commitIndex,
  readIndex,
} from "../storage/bank";
import { normalizeBundle } from "../domain/contracts";
import { preparePrivateMedia } from "./privateMedia";
import * as Crypto from "expo-crypto";
import * as records from "../storage/records";
import { request, requestText } from "./api";
import type { Bundle, Catalog, Question, Asset } from "../domain/types";
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
    {},
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
export async function download(
  owner: string,
  value: Manifest,
  selected: string[],
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
) {
  const parts = value.parts.filter((part) => selected.includes(part.hash));
  if (!parts.length) throw new Error("Choose a subject or paper.");
  let done = 0;
  const total = parts.reduce((n, p) => n + p.bytes, 0);
  const questions: Question[] = [],
    assets: Record<string, Asset> = {};
  for (const part of parts) {
    signal.throwIfAborted();
    const id = value.bundle.id + ":" + part.hash;
    let text = await records.read<string>(owner, "download-part", id);
    if (
      !text ||
      (await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        text,
      )) !== part.hash
    ) {
      text = await requestText(
        "/api/library/bundles/" +
          encodeURIComponent(value.bundle.id) +
          "/parts/" +
          part.hash,
        { signal },
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
  signal.throwIfAborted();
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
  return saveBundle(owner, bundle);
}

export async function savedUploads(owner: string, signal?: AbortSignal) {
  const rows: Bundle[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    if ((await supabase?.auth.getSession())?.data.session?.user.id !== owner)
      throw new Error("Your account changed. Reopen your library.");
    const value: { materials: Bundle[]; nextOffset?: number } = await request(
      "/api/vision/materials?offset=" + offset + "&limit=100",
      { signal },
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
