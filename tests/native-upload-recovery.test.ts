import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
function harness() {
  const disk = new Map<string, Uint8Array>(),
    received = new Set<number>(),
    sent: number[] = [],
    options: any[] = [],
    subscribed: any[] = [],
    released: number[] = [];
  let failure = true;
  class Directory {
    uri: string;
    constructor(...p: any[]) {
      this.uri = p.map((x) => (typeof x === "string" ? x : x.uri)).join("/");
    }
    create() {}
    get exists() {
      return true;
    }
    delete() {
      for (const name of disk.keys())
        if (name.startsWith(this.uri + "/")) disk.delete(name);
    }
  }
  class File {
    uri: string;
    constructor(...p: any[]) {
      this.uri = p.map((x) => (typeof x === "string" ? x : x.uri)).join("/");
    }
    get exists() {
      return disk.has(this.uri);
    }
    get size() {
      return disk.get(this.uri)?.length || 0;
    }
    async copy(to: File) {
      disk.set(to.uri, disk.get(this.uri)!.slice());
    }
    write(bytes: Uint8Array) {
      disk.set(this.uri, bytes.slice());
    }
    delete() {
      disk.delete(this.uri);
    }
    open() {
      let at = 0;
      const file = this;
      return {
        readBytes: (n: number) => {
          const bytes = disk.get(file.uri)!.slice(at, at + n);
          at += bytes.length;
          return bytes;
        },
        close() {},
      };
    }
    createUploadTask(url: string, opt: any) {
      options.push(opt);
      const p = Number(url.split("/").pop());
      return {
        uploadAsync: async () => {
          sent.push(p);
          if (p === 1 && failure) {
            failure = false;
            throw Error("Connection lost");
          }
          assert.equal(opt.headers["Content-Type"], "application/octet-stream");
          received.add(p);
          return { status: 200, body: "{}" };
        },
        release: () => released.push(p),
      };
    }
  }
  const sha = (bytes: any) => createHash("sha256").update(bytes).digest(),
    exports: any = {};
  const deps: any = {
    "expo-file-system": {
      File,
      Directory,
      Paths: { document: "documents" },
      UploadType: { BINARY_CONTENT: 0 },
    },
    "expo-crypto": {
      CryptoDigestAlgorithm: { SHA256: "sha256" },
      randomUUID: () => "durable-source",
      digestStringAsync: async (_: string, s: string) => sha(s).toString("hex"),
      digest: async (_: string, b: Uint8Array) => {
        const bytes = sha(b);
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.length,
        );
      },
    },
    "./api": {
      apiUrl: (p: string) => "https://api.test" + p,
      json: (_m: string, body: any) => ({ body }),
      request: async (_p: string, opts: any) => ({
        files: opts.body.files,
        status: "uploading",
        received: [[...received]],
      }),
    },
    "./auth": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: {
              session: { user: { id: "owner" }, access_token: "test-token" },
            },
          }),
          onAuthStateChange: (fn: any) => {
            subscribed.push(fn);
            return {
              data: { subscription: { unsubscribe: () => subscribed.pop() } },
            };
          },
        },
      },
    },
    "../domain/cancellation": {
      checkCancelled: (s: AbortSignal) => {
        if (s?.aborted) throw Error("Cancelled");
      },
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/uploadTransport.native.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (n: string) => {
        if (n in deps) return deps[n];
        throw Error(n);
      },
      Map,
      Set,
      Array,
      Uint8Array,
      Promise,
      Error,
      Math,
      AbortController,
    },
  );
  const original = new Uint8Array(4 * 1048576 + 100);
  original.fill(7);
  disk.set("cache/notes.pdf", original);
  return { api: exports, disk, received, sent, options, released, subscribed };
}
test("native upload retains durable source on interruption and retries only unacknowledged parts", async () => {
  const h = harness(),
    files = await h.api.stageUploadFiles("owner", [
      {
        uri: "cache/notes.pdf",
        name: "notes.pdf",
        mimeType: "application/pdf",
        size: 4 * 1048576 + 100,
      },
    ]);
  assert.match(files[0].uri, /documents\/focalpoint-uploads/);
  await assert.rejects(
    h.api.transferUpload("session", files, () => {}),
    /Connection lost/,
  );
  assert.equal(h.disk.has(files[0].uri), true);
  assert.deepEqual(h.sent, [0, 1]);
  await h.api.transferUpload("session", files, () => {});
  assert.deepEqual(h.sent, [0, 1, 1]);
  assert.equal(h.disk.has(files[0].uri), false);
  assert.equal(h.subscribed.length, 0);
  assert.equal(h.released.length, 3);
  for (const o of h.options) assert.equal(o.sessionType, "background");
});
test("double-tapping an upload shares one native transfer and both callers receive its failure", async () => {
  const h = harness(),
    files = await h.api.stageUploadFiles("owner", [
      {
        uri: "cache/notes.pdf",
        name: "notes.pdf",
        mimeType: "application/pdf",
        size: 4 * 1048576 + 100,
      },
    ]);
  const results = await Promise.allSettled([
    h.api.transferUpload("session", files, () => {}),
    h.api.transferUpload("session", files, () => {}),
  ]);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.deepEqual(h.sent, [0, 1]);
});
