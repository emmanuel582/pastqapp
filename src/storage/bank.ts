import type { Bundle, Question, Asset } from "../domain/types";
import type { DownloadPart } from "../services/library";
export const supportsIndex = false;
export async function indexPart(
  _owner: string,
  _bundle: Bundle,
  _version: string,
  _part: DownloadPart,
  _payload: { questions: Question[]; assets: Record<string, Asset> },
  _sourceOffset = 0,
) {}
export async function commitIndex(
  _owner: string,
  bundle: Bundle,
  _version: string,
  _selected: string[],
  _count: number,
  _bytes: number,
  _partial: boolean,
  _selection: DownloadPart[] = [],
) {
  return bundle;
}
export async function readIndex(
  _owner: string,
  _id: string,
): Promise<Bundle | null> {
  return null;
}
export async function resolveQuestion(
  _owner: string,
  q: Question,
): Promise<{ question: Question; assets: Record<string, Asset> | undefined }> {
  return { question: q, assets: undefined };
}
export async function bankBytes(_owner: string) {
  return 0;
}

export async function searchIndex(
  _owner: string,
  _bundle: Bundle,
  _query: string,
  _limit = 40,
): Promise<Question[]> {
  return [];
}

export async function removeIndex(_owner: string, _bundleId: string) {}
