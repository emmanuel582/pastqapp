import { File as LocalFile } from "expo-file-system";
import type { UploadFile } from "./uploads";
/** SDK 57 multipart accepts bytes-backed files; legacy {uri} parts throw before sending. */
export async function appendUploadFile(
  form: FormData,
  key: string,
  file: UploadFile,
) {
  const local = new LocalFile(file.uri);
  if (!local.exists)
    throw Error("This file is no longer on your device. Choose it again.");
  const part = {
    name: file.name,
    type: file.mimeType,
    bytes: () => local.bytes(),
  };
  form.append(key, part as unknown as Blob);
}
