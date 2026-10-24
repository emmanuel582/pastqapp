import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function moduleAt(file: string, dependencies: Record<string, unknown> = {}) {
  const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Blob,
    URL,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Promise,
    Error,
    encodeURIComponent,
    require: (name: string) => {
      if (name in dependencies) return dependencies[name];
      throw Error("Unexpected import " + name);
    },
  });
  return exports;
}
function sdkMultipart() {
  class NativeForm {
    _parts: any[] = [];
  }
  const patch = moduleAt("node_modules/expo/src/winter/FormData.ts");
  const Form = patch.installFormDataPatch(NativeForm);
  const converter = moduleAt(
    "node_modules/expo/src/winter/fetch/convertFormData.ts",
    {
      "../../utils/blobUtils": {
        blobToArrayBufferAsync: (b: Blob) => b.arrayBuffer(),
      },
    },
  );
  return { Form, convert: converter.convertFormDataAsync };
}
test("reproduces SDK 57's unsupported legacy URI multipart part", async () => {
  const { Form, convert } = sdkMultipart();
  const form = new Form();
  form.append("images", {
    uri: "file:///paper.jpg",
    name: "paper.jpg",
    type: "image/jpeg",
  });
  await assert.rejects(
    convert(form),
    /Unsupported FormDataPart implementation/,
  );
});
test("native photo and PDF parts pass the installed SDK encoder with exact file bytes, names and MIME", async () => {
  const data: Record<string, Uint8Array> = {
    "file:///photo.jpg": new Uint8Array([255, 216, 255, 224]),
    "file:///exam.pdf": new TextEncoder().encode("%PDF-1.7 test"),
  };
  class LocalFile {
    constructor(public uri: string) {}
    get exists() {
      return this.uri in data;
    }
    async bytes() {
      return data[this.uri];
    }
  }
  const { appendUploadFile } = moduleAt(
    "src/services/multipartFile.native.ts",
    { "expo-file-system": { File: LocalFile } },
  );
  const { Form, convert } = sdkMultipart();
  const form = new Form();
  await appendUploadFile(form, "images", {
    uri: "file:///photo.jpg",
    name: "Page 1.jpg",
    mimeType: "image/jpeg",
  });
  await appendUploadFile(form, "pdf", {
    uri: "file:///exam.pdf",
    name: "Exam.pdf",
    mimeType: "application/pdf",
  });
  form.append("followUpId", "follow-up-1");
  const { body } = await convert(form, "qa-boundary");
  const text = new TextDecoder().decode(body);
  assert.match(text, /filename="Page%201.jpg"/);
  assert.match(text, /content-type: image\/jpeg/);
  assert.match(text, /filename="Exam.pdf"/);
  assert.match(text, /content-type: application\/pdf/);
  assert.match(text, /%PDF-1.7 test/);
  assert.match(text, /follow-up-1/);
  assert.ok(Buffer.from(body).includes(Buffer.from(data["file:///photo.jpg"])));
  await assert.rejects(
    appendUploadFile(new Form(), "images", {
      uri: "file:///missing.jpg",
      name: "missing.jpg",
      mimeType: "image/jpeg",
    }),
    /Choose it again/,
  );
});
