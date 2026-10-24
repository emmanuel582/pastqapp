import { requestText } from "./api";
import * as records from "../storage/records";
import type { Manifest, DownloadPart } from "./library";
export async function prepareParts(
  _owner: string,
  _value: Manifest,
  _selected: string[],
  _signal: AbortSignal,
  _onProgress?: (done: number, total: number) => void,
) {
  return () => {};
}
export async function readPart(
  _owner: string,
  value: Manifest,
  part: DownloadPart,
  signal: AbortSignal,
  _progress: (bytes: number) => void,
) {
  return requestText(
    "/api/library/bundles/" +
      encodeURIComponent(value.bundle.id) +
      "/parts/" +
      part.hash,
    { signal },
  );
}
export async function pauseParts(_owner: string, _value: Manifest) {}
export async function forgetParts(
  _owner: string,
  _value: Manifest,
  _selected: string[],
) {}

export async function clearTransferCache(owner: string) {
  await records.commit(owner, [{ kind: "download-part", remove: true }]);
}
