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
