import * as Crypto from "expo-crypto";
import { request, json } from "./api";
import { checkCancelled } from "../domain/cancellation";
import type { UploadFile } from "./uploads";
export async function stageUploadFiles(_owner: string, files: UploadFile[]) {
  return files;
}
export async function transferUpload(
  id: string,
  files: UploadFile[],
  onProgress: (done: number, total: number, label: string) => void,
  signal?: AbortSignal,
) {
  const chunks: { f: number; p: number; bytes: Uint8Array<ArrayBuffer> }[] = [],
    plans = [];
  for (let f = 0; f < files.length; f++) {
    const blob = files[f].file || (await (await fetch(files[f].uri)).blob()),
      hashes = [];
    for (
      let offset = 0, p = 0;
      offset < blob.size;
      offset += 4 * 1048576, p++
    ) {
      checkCancelled(signal);
      const bytes = new Uint8Array(
        await blob.slice(offset, offset + 4 * 1048576).arrayBuffer(),
      );
      const digest = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytes,
      );
      hashes.push(
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      );
      chunks.push({ f, p, bytes });
    }
    plans.push({ name: files[f].name, size: blob.size, hashes });
  }
  const state = await request<{ received: number[][] }>(
    "/api/transfers/" + id,
    { ...json("POST", { files: plans }), signal },
    true,
  );
  const total = plans.reduce((n, f) => n + f.size, 0);
  let done = 0;
  for (const c of chunks) {
    checkCancelled(signal);
    if (!state.received[c.f]?.includes(c.p))
      await request(
        `/api/transfers/${id}/${c.f}/${c.p}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: c.bytes,
          signal,
          timeoutMs: 180000,
        },
        true,
      );
    done += c.bytes.byteLength;
    onProgress(done, total, "Uploading material");
  }
}
