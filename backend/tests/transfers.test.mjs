import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  TransferStore,
  PART_BYTES,
  validateFiles,
  transferKind,
} from "../vps-overlay/services/vision/transfers.js";
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focal-transfer-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return new TransferStore(dir);
}
test("interrupted upload survives restart, accepts out-of-order parts and retries without duplicate bytes", (t) => {
  const store = setup(t),
    first = crypto.randomBytes(PART_BYTES),
    last = Buffer.from("last question"),
    input = [
      {
        name: "Revision.pdf",
        size: first.length + last.length,
        hashes: [sha(first), sha(last)],
      },
    ];
  store.prepare(input);
  store.put(0, 1, last);
  const reopened = new TransferStore(store.folder);
  assert.deepEqual(reopened.prepare(input).received, [[1]]);
  reopened.put(0, 1, last);
  assert.deepEqual(reopened.read().received, [[1]]);
  reopened.put(0, 0, first);
  assert.equal(reopened.read().status, "ready");
  assert.deepEqual(
    fs.readFileSync(reopened.assemble(0)),
    Buffer.concat([first, last]),
  );
  reopened.update({ status: "accepted" });
  reopened.clearParts();
  assert.equal(reopened.put(0, 1, last).status, "accepted");
});
test("rejects corrupt bytes, wrong lengths, changed source and unknown part indexes", (t) => {
  const store = setup(t),
    bytes = Buffer.from("questions"),
    input = [{ name: "notes.docx", size: bytes.length, hashes: [sha(bytes)] }];
  store.prepare(input);
  assert.throws(
    () => store.put(0, 0, Buffer.alloc(bytes.length)),
    /did not match/,
  );
  assert.deepEqual(store.read().received, [[]]);
  assert.throws(() => store.put(0, -1, bytes), /Unknown/);
  assert.throws(() => store.put(0, 1, bytes), /Unknown/);
  assert.throws(
    () => store.prepare([{ ...input[0], name: "different.docx" }]),
    /differ/,
  );
  assert.throws(() => store.assemble(0), /incomplete/);
});
test("validates phone/document formats, metadata, quotas, names and mixed file selection", () => {
  for (const ext of [
    "heic",
    "heif",
    "jpeg",
    "png",
    "webp",
    "pdf",
    "docx",
    "doc",
    "pptx",
    "ppt",
    "odt",
    "rtf",
    "txt",
  ])
    assert.ok(transferKind("student." + ext));
  const part = {
    name: "../../notes.docx",
    size: 1,
    hashes: [sha(Buffer.from("a"))],
  };
  assert.equal(validateFiles([part])[0].name, "notes.docx");
  for (const files of [
    [],
    [{ ...part, name: "malware.exe" }],
    [{ ...part, size: 0 }],
    [{ ...part, size: 201 * 1048576 }],
    [{ ...part, hashes: ["invalid"] }],
    [part, part],
  ])
    assert.throws(() => validateFiles(files));
});
