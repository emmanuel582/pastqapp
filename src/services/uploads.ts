import { appendUploadFile as appendFile } from "./multipartFile";
export { appendUploadFile as appendFile } from "./multipartFile";
import { checkCancelled } from "../domain/cancellation";
import { transferUpload } from "./uploadTransport";
import { supportedMaterial } from "../domain/files";
import { request, json } from "./api";
import type { VisionSession, Bundle, Question } from "../domain/types";
export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  file?: File;
}
export interface UploadDraft {
  started?: boolean;
  files: UploadFile[];
  name: string;
  sessionId?: string;
}
export async function extractText(
  text: string,
  name: string,
  signal?: AbortSignal,
) {
  const result = await request<{ sessionId?: string; jobId?: string }>(
    "/api/vision/extract-text",
    { ...json("POST", { text, name, icon: "📝" }), signal },
    true,
  );
  const id = result.sessionId || result.jobId;
  if (!id)
    throw new Error("Your upload could not be opened. Please try again.");
  return id;
}
export async function uploadMaterial(
  files: UploadFile[],
  name: string,
  onProgress: (done: number, total: number, label: string) => void,
  resumeId?: string,
  onSession?: (id: string) => Promise<void>,
  signal?: AbortSignal,
) {
  checkCancelled(signal);
  if (!files.length) throw new Error("Choose your material first.");
  if (files.some((f) => !supportedMaterial(f.name)))
    throw new Error(
      "Choose photos, PDF, Word, PowerPoint, ODT, RTF or text files.",
    );
  if (files.length > 1 && !files.every((f) => f.mimeType.startsWith("image/")))
    throw new Error("Choose one document or a group of photos.");
  const session = resumeId
    ? await visionSession(resumeId, signal)
    : await request<VisionSession>(
        "/api/vision/sessions",
        { ...json("POST", { name: name.trim() || "New material" }), signal },
        true,
      );
  if (!session.id) throw new Error("Your upload could not be opened.");
  checkCancelled(signal);
  await onSession?.(session.id);
  if (resumeId && !["pending", "uploading"].includes(session.status))
    return session.id;
  await transferUpload(session.id, files, onProgress, signal);
  checkCancelled(signal);
  return session.id;
}
export const visionSession = (id: string, signal?: AbortSignal) =>
  request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id),
    { signal },
    true,
  );
export const resumeVision = async (id: string) => {
  const transfer = await request<{ status: string; files: unknown[] }>(
    "/api/transfers/" + encodeURIComponent(id),
    {},
    true,
  ).catch(() => null);
  if (transfer?.status === "failed") {
    await request(
      "/api/transfers/" + encodeURIComponent(id),
      json("POST", { files: transfer.files }),
      true,
    );
    return visionSession(id);
  }
  return request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id) + "/resume",
    json("POST", {}),
    true,
  );
};
export const confirmMaterial = (id: string, questions: Question[]) =>
  request<Bundle>(
    "/api/vision/sessions/" + encodeURIComponent(id) + "/confirm",
    json("PUT", { questions }),
    true,
  );
export const replyVision = (id: string, form: FormData) =>
  request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id) + "/reply",
    { method: "POST", body: form, timeoutMs: 180000 },
    true,
  );

export async function insertVisionPage(
  id: string,
  file: UploadFile,
  insertAt?: number,
) {
  const form = new FormData();
  await appendFile(form, "images", file);
  if (insertAt !== undefined) form.append("insertAt", String(insertAt));
  return request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id) + "/pages",
    { method: "POST", body: form, timeoutMs: 180000 },
    true,
  );
}
