import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export const PART_BYTES = 4 * 1024 * 1024;
export const MAX_TRANSFER_BYTES = 300 * 1024 * 1024;
export const officeExtensions = new Set([
  "docx",
  "doc",
  "odt",
  "rtf",
  "pptx",
  "ppt",
]);
const photoExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
]);
const textExtensions = new Set(["txt", "md", "json"]);
export function transferKind(name) {
  const ext = String(name).toLowerCase().split(".").pop();
  if (photoExtensions.has(ext)) return "image";
  if (officeExtensions.has(ext)) return "office";
  if (textExtensions.has(ext)) return "text";
  if (ext === "pdf") return "pdf";
  return null;
}
export function validateFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > 60)
    throw Object.assign(Error("Choose one document or up to 60 photos."), {
      status: 400,
    });
  let total = 0;
  const result = files.map((f) => {
    const name =
      typeof f.name === "string"
        ? path.basename(f.name.replaceAll("\\", "/")).slice(0, 180)
        : "";
    const kind = transferKind(name);
    if (!kind)
      throw Object.assign(
        Error("Use photos, PDF, Word, PowerPoint, ODT, RTF or text files."),
        { status: 400 },
      );
    if (
      !Number.isSafeInteger(f.size) ||
      f.size <= 0 ||
      f.size > (kind === "image" ? 40 : kind === "text" ? 10 : 200) * 1048576
    )
      throw Object.assign(Error("This file is empty or too large."), {
        status: 400,
      });
    if (
      !Array.isArray(f.hashes) ||
      f.hashes.length !== Math.ceil(f.size / PART_BYTES) ||
      f.hashes.some((h) => typeof h !== "string" || !/^[a-f0-9]{64}$/.test(h))
    )
      throw Object.assign(Error("Invalid upload parts."), { status: 400 });
    total += f.size;
    return { name, kind, size: f.size, hashes: f.hashes };
  });
  if (
    total > MAX_TRANSFER_BYTES ||
    (result.length > 1 && result.some((f) => f.kind !== "image"))
  )
    throw Object.assign(
      Error("Choose one document or a group of photos, below 300 MB in total."),
      { status: 400 },
    );
  return result;
}
export function atomicJson(file, value) {
  const tmp = file + "." + crypto.randomUUID() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}
/** All paths come from verified session IDs and bounded numeric indexes. */
export class TransferStore {
  constructor(folder) {
    this.folder = folder;
    fs.mkdirSync(folder, { recursive: true });
    this.file = path.join(folder, "manifest.json");
  }
  read() {
    return fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, "utf8"))
      : null;
  }
  prepare(input) {
    const files = validateFiles(input),
      old = this.read();
    if (old) {
      if (JSON.stringify(old.files) !== JSON.stringify(files))
        throw Object.assign(
          Error(
            "These files differ from the saved upload. Start a new upload.",
          ),
          { status: 409 },
        );
      return old;
    }
    const state = {
      files,
      status: "uploading",
      received: files.map(() => []),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    atomicJson(this.file, state);
    return state;
  }
  partFile(f, p) {
    return path.join(this.folder, `${f}-${p}.part`);
  }
  put(fileIndex, partIndex, bytes) {
    const state = this.read(),
      f = state?.files[fileIndex];
    if (
      !Number.isSafeInteger(fileIndex) ||
      !Number.isSafeInteger(partIndex) ||
      partIndex < 0 ||
      !f ||
      partIndex >= f.hashes.length
    )
      throw Object.assign(Error("Unknown upload part."), { status: 400 });
    const length = Math.min(PART_BYTES, f.size - partIndex * PART_BYTES);
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length !== length ||
      crypto.createHash("sha256").update(bytes).digest("hex") !==
        f.hashes[partIndex]
    )
      throw Object.assign(
        Error("Upload part did not match. Retry this part."),
        { status: 422 },
      );
    if (state.received[fileIndex].includes(partIndex)) return state;
    const target = this.partFile(fileIndex, partIndex),
      tmp = target + ".tmp";
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, target);
    state.received[fileIndex].push(partIndex);
    state.received[fileIndex].sort((a, b) => a - b);
    state.updatedAt = Date.now();
    if (
      state.files.every(
        (file, i) => state.received[i].length === file.hashes.length,
      )
    )
      state.status = "ready";
    atomicJson(this.file, state);
    return state;
  }
  assemble(index) {
    const state = this.read(),
      f = state?.files[index];
    if (!f || state.received[index].length !== f.hashes.length)
      throw Error("Upload is incomplete.");
    const target = path.join(
      this.folder,
      `source-${index}.` + f.name.split(".").pop().toLowerCase(),
    );
    if (fs.existsSync(target) && fs.statSync(target).size === f.size)
      return target;
    const tmp = target + ".tmp",
      out = fs.openSync(tmp, "w");
    try {
      for (let i = 0; i < f.hashes.length; i++) {
        const bytes = fs.readFileSync(this.partFile(index, i));
        if (
          crypto.createHash("sha256").update(bytes).digest("hex") !==
          f.hashes[i]
        )
          throw Error("Stored upload part failed verification.");
        fs.writeSync(out, bytes);
      }
      fs.fsyncSync(out);
    } finally {
      fs.closeSync(out);
    }
    fs.renameSync(tmp, target);
    return target;
  }
  update(values) {
    const state = this.read();
    Object.assign(state, values, { updatedAt: Date.now() });
    atomicJson(this.file, state);
    return state;
  }
  clearParts() {
    for (const name of fs.readdirSync(this.folder))
      if (/^\d+-\d+\.part$/.test(name))
        fs.unlinkSync(path.join(this.folder, name));
  }
}
