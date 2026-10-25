import type { VisionSession } from "../domain/types";
import { uploadStage, type UploadStage } from "../domain/uploadReview";
import { request } from "./api";
import * as records from "../storage/records";
export interface UploadSummary {
  id: string;
  name: string;
  status: string;
  approvedAt?: string | null;
  createdAt: number;
  updatedAt: number;
  questionCount: number;
  openChecks: number;
  progress?: VisionSession["progress"];
}
export function summarizeUpload(s: VisionSession): UploadSummary {
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    approvedAt: s.approvedAt,
    createdAt: Number(s.createdAt) || Date.now(),
    updatedAt: Number(s.updatedAt) || Date.now(),
    questionCount: s.questions?.length || 0,
    openChecks:
      (s.followUps || []).filter((f) => f.status === "open").length +
      (s.questions || []).filter(
        (q) => q.incomplete || q.needsReview || q.type === "other",
      ).length,
    progress: s.progress,
  };
}
export async function rememberUpload(owner: string, s: VisionSession) {
  await records.commit(owner, [
    { kind: "vision-session", id: s.id, value: s },
    { kind: "upload-item", id: s.id, value: summarizeUpload(s) },
  ]);
}
const order: Record<UploadStage, number> = {
  attention: 0,
  failed: 1,
  uploading: 2,
  processing: 2,
  review: 3,
  completed: 4,
};
export function sortUploads(rows: UploadSummary[]) {
  return [...rows].sort(
    (a, b) =>
      order[uploadStage(a)] - order[uploadStage(b)] ||
      b.updatedAt - a.updatedAt,
  );
}
export async function cachedUploads(owner: string) {
  return sortUploads(await records.list<UploadSummary>(owner, "upload-item"));
}
export async function loadUploads(
  owner: string,
  limit: number,
  signal: AbortSignal,
) {
  const startedAt = Date.now();
  let offset = 0;
  const items: UploadSummary[] = [];
  let total = 0;
  do {
    const result = await request<{
      items: UploadSummary[];
      total: number;
      nextOffset: number | null;
    }>(
      "/api/transfers?offset=" +
        offset +
        "&limit=" +
        Math.min(100, limit - items.length),
      { signal },
      true,
    );
    items.push(...result.items);
    total = result.total;
    if (result.nextOffset === null || result.nextOffset <= offset) break;
    offset = result.nextOffset;
  } while (items.length < limit);
  if (items.length >= total) {
    const ids = new Set(items.map((row) => row.id));
    for (const old of await records.list<UploadSummary>(owner, "upload-item"))
      if (!ids.has(old.id) && old.updatedAt <= startedAt)
        await records.compareAndSwap(owner, "upload-item", old.id, old, null);
  }
  for (const row of items)
    await records.write(owner, "upload-item", row.id, row);
  return { items: sortUploads(items), total };
}
export async function rememberPendingUpload(
  owner: string,
  id: string,
  name: string,
  status = "uploading",
) {
  const old = await records.read<UploadSummary>(owner, "upload-item", id);
  await records.write(owner, "upload-item", id, {
    id,
    name: name.trim() || "New material",
    status,
    createdAt: old?.createdAt || Date.now(),
    updatedAt: Date.now(),
    questionCount: 0,
    openChecks: 0,
  });
}
