/** Android providers sometimes omit MIME types or return application/octet-stream. */
export function materialMimeType(name: string, reported?: string | null) {
  const mime = reported?.toLowerCase();
  if (
    mime &&
    (mime.startsWith("image/") ||
      mime.startsWith("text/") ||
      mime === "application/pdf" ||
      mime === "application/json")
  )
    return mime;
  const extension = name.toLowerCase().split(".").pop();
  const known: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    odt: "application/vnd.oasis.opendocument.text",
    rtf: "application/rtf",
    json: "application/json",
    txt: "text/plain",
    md: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
  };
  return known[extension || ""] || mime || "application/octet-stream";
}

export function supportedMaterial(name: string) {
  return /\.(pdf|docx?|pptx?|odt|rtf|txt|md|json|jpe?g|png|webp|gif|heic|heif)$/i.test(
    name,
  );
}
export const materialPickerTypes = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/rtf",
];
