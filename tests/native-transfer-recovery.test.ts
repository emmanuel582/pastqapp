import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function harness(ignoreRange = false) {
  const disk = new Map<string, Uint8Array>(),
    records = new Map<string, any>(),
    requests: any[] = [];
  const text = '{"questions":[{"id":1,"question":"A real cached question"}]}',
    bytes = new TextEncoder().encode(text);
  let first = true;
  class Directory {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    create() {}
    get exists() {
      return true;
    }
    delete() {
      for (const key of disk.keys())
        if (key.startsWith(this.uri + "/")) disk.delete(key);
    }
  }
  class File {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    get exists() {
      return disk.has(this.uri);
    }
    get size() {
      return disk.get(this.uri)?.length || 0;
    }
    get parentDirectory() {
      return new Directory(this.uri.slice(0, this.uri.lastIndexOf("/")));
    }
    create() {
      disk.set(this.uri, new Uint8Array());
    }
    delete() {
      disk.delete(this.uri);
    }
    async move(target: File) {
      disk.set(target.uri, disk.get(this.uri)!);
      disk.delete(this.uri);
      this.uri = target.uri;
    }
    async text() {
      return new TextDecoder().decode(disk.get(this.uri));
    }
    open(mode?: string) {
      let offset = mode === "append" ? this.size : 0;
      const file = this;
      return {
        readBytes: (n: number) => {
          const value = disk.get(file.uri)!.slice(offset, offset + n);
          offset += value.length;
          return value;
        },
        writeBytes: (value: Uint8Array) => {
          const old = disk.get(file.uri) || new Uint8Array();
          const merged = new Uint8Array(old.length + value.length);
          merged.set(old);
          merged.set(value, old.length);
          disk.set(file.uri, merged);
        },
        close: () => {},
      };
    }
    static createDownloadTask(url: string, file: File, options: any) {
      const task: any = {
        state: "idle",
        release() {},
        async downloadAsync() {
          requests.push({ url, headers: options.headers });
          task.state = "active";
          if (first) {
            first = false;
            disk.set(file.uri, bytes.slice(0, 17));
            task.state = "error";
            throw Error("Network failed");
          }
          const start = Number(options.headers.Range?.match(/\d+/)?.[0] || 0),
            result = ignoreRange ? bytes : bytes.slice(start);
          disk.set(file.uri, result);
          task.state = "completed";
          return file;
        },
      };
      return task;
    }
  }
  const recordKey = (o: string, k: string, id: string) =>
    JSON.stringify([o, k, id]);
  const exports: any = {};
  const code = ts.transpileModule(
    fs.readFileSync("src/services/downloadTransport.native.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const dependencies: any = {
    "expo-file-system": {
      File,
      Directory,
      Paths: { cache: "cache" },
      FileMode: { ReadOnly: "read", Append: "append" },
    },
    "expo-crypto": {
      CryptoDigestAlgorithm: { SHA256: "sha256" },
      digestStringAsync: async (_: string, value: string) => sha(value),
    },
    "react-native": { Platform: { OS: "android" } },
    "../storage/records": {
      read: async (o: string, k: string, id: string) =>
        records.get(recordKey(o, k, id)) || null,
      write: async (o: string, k: string, id: string, v: any) =>
        records.set(recordKey(o, k, id), v),
      remove: async (o: string, k: string, id: string) =>
        records.delete(recordKey(o, k, id)),
    },
    "./api": { apiUrl: (p: string) => "https://api.example" + p },
    "../storage/bank": { hasIndexPart: async () => false },
    "../domain/cancellation": {
      checkCancelled: (s: AbortSignal) => {
        if (s.aborted) throw Error("Cancelled");
      },
    },
  };
  vm.runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name in dependencies) return dependencies[name];
      throw Error("Unexpected " + name);
    },
    Map,
    Set,
    Promise,
    Error,
    Date,
    Math,
    encodeURIComponent,
  });
  const part = { hash: sha(text), bytes: bytes.length, count: 1 },
    manifest = { bundle: { id: "paper" }, version: "1", parts: [part] };
  return {
    read: () =>
      exports.readPart(
        "owner",
        manifest,
        part,
        new AbortController().signal,
        () => {},
      ),
    requests,
    text,
  };
}
for (const ignoreRange of [false, true])
  test(
    "interrupted native download preserves bytes and " +
      (ignoreRange
        ? "handles a proxy returning the full file"
        : "resumes only missing bytes"),
    async () => {
      const h = harness(ignoreRange);
      await assert.rejects(h.read(), /Network failed/);
      assert.equal(await h.read(), h.text);
      assert.equal(h.requests.length, 2);
      assert.equal(h.requests[1].headers.Range, "bytes=17-");
      assert.equal(h.requests[1].headers["Accept-Encoding"], "identity");
    },
  );
