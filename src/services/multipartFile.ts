import type { UploadFile } from "./uploads";
export async function appendUploadFile(
  form: FormData,
  key: string,
  file: UploadFile,
) {
  const blob =
    file.file instanceof Blob
      ? file.file
      : await fetch(file.uri).then((res) => {
          if (!res.ok)
            throw Error("This file could not be opened. Choose it again.");
          return res.blob();
        });
  form.append(key, blob, file.name);
}
