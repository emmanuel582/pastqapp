import { checkCancelled } from "../domain/cancellation";
import { Platform, Image as NativeImage } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { request, json } from "./api";
import { readTextFile } from "./files";
import type { VisionSession, Bundle, Question } from "../domain/types";
export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  file?: File;
}
export interface UploadDraft {
  files: UploadFile[];
  name: string;
  sessionId?: string;
}
export function appendFile(form: FormData, key: string, file: UploadFile) {
  if (Platform.OS === "web" && file.file)
    form.append(key, file.file, file.name);
  else
    form.append(key, {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
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
  const images = files.every((f) => f.mimeType.startsWith("image/"));
  if (!images && files.length > 1)
    throw new Error("Choose one PDF or text file, or a group of photos.");
  if (
    !images &&
    (files[0].mimeType.startsWith("text/") ||
      files[0].mimeType === "application/json")
  ) {
    const text = await readTextFile(files[0].uri);
    if (!text.trim())
      throw new Error("This file has no text. Choose another file.");
    return extractText(text, name.trim() || "New material", signal);
  }
  if (!images && files[0].mimeType !== "application/pdf")
    throw new Error("Choose photos, a PDF or a text file.");
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
  if (resumeId && !images && session.ingest) return session.id;
  if (!images) {
    const form = new FormData();
    appendFile(form, "pdf", files[0]);
    onProgress(0, 1, "Uploading your PDF");
    await request(
      "/api/vision/sessions/" + session.id + "/pdf",
      { method: "POST", body: form, timeoutMs: 180000, signal },
      true,
    );
    onProgress(1, 1, "Material uploaded");
  } else {
    for (
      let index = resumeId ? session.progress?.total || 0 : 0;
      index < files.length;
      index += 8
    ) {
      checkCancelled(signal);
      const form = new FormData(),
        batch = files.slice(index, index + 8);
      onProgress(index, files.length, "Preparing your photos");
      for (const file of batch) {
        checkCancelled(signal);
        const { width, height } = await new Promise<{
          width: number;
          height: number;
        }>((resolve, reject) =>
          NativeImage.getSize(
            file.uri,
            (width, height) => resolve({ width, height }),
            reject,
          ),
        );
        const resized = await manipulateAsync(
          file.uri,
          Math.max(width, height) > 2560
            ? [{ resize: width > height ? { width: 2560 } : { height: 2560 } }]
            : [],
          { compress: 0.94, format: SaveFormat.JPEG },
        );
        const photo = {
          ...file,
          uri: resized.uri,
          name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
          mimeType: "image/jpeg",
          file:
            Platform.OS === "web"
              ? new File(
                  [await (await fetch(resized.uri)).blob()],
                  file.name + ".jpg",
                  { type: "image/jpeg" },
                )
              : undefined,
        };
        appendFile(form, "images", photo);
      }
      onProgress(index, files.length, "Uploading your photos");
      await request(
        "/api/vision/sessions/" + session.id + "/pages",
        { method: "POST", body: form, timeoutMs: 180000, signal },
        true,
      );
      onProgress(index + batch.length, files.length, "Photos uploaded");
    }
    await request(
      "/api/vision/sessions/" + session.id + "/start",
      { ...json("POST", {}), signal },
      true,
    );
  }
  checkCancelled(signal);
  return session.id;
}
export const visionSession = (id: string, signal?: AbortSignal) =>
  request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id),
    { signal },
    true,
  );
export const resumeVision = (id: string) =>
  request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id) + "/resume",
    json("POST", {}),
    true,
  );
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
  appendFile(form, "images", file);
  if (insertAt !== undefined) form.append("insertAt", String(insertAt));
  return request<VisionSession>(
    "/api/vision/sessions/" + encodeURIComponent(id) + "/pages",
    { method: "POST", body: form, timeoutMs: 180000 },
    true,
  );
}
