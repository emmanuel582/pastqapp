import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { checkCancelled } from "../src/domain/cancellation";
function fixture(shared?: any) {
  const files: Map<string, string> = shared?.files || new Map(),
    values: Map<string, unknown> = shared?.values || new Map(),
    tasks: any[] = [],
    restored: any[] = [];
  class Directory {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return Buffer.byteLength(files.get(this.uri) || "");
    }
    delete() {
      files.delete(this.uri);
    }
    async text() {
      return files.get(this.uri) || "";
    }
    static createDownloadTask(url: string, file: File, options: any) {
      return new Task(url, file, options);
    }
  }
  class Task {
    state = "idle";
    resolve!: (f: any) => void;
    reject!: (e: any) => void;
    pending!: Promise<any>;
    constructor(
      public url: string,
      public file: File,
      public options: any,
    ) {
      tasks.push(this);
    }
    downloadAsync() {
      this.state = "active";
      return (this.pending = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      }));
    }
    resumeAsync() {
      restored.push(this);
      return this.downloadAsync();
    }
    pauseCount = 0;
    async pauseAsync() {
      this.pauseCount++;
      this.state = "paused";
      this.resolve(null);
      await this.pending;
    }
    savable() {
      return {
        url: this.url,
        fileUri: this.file.uri,
        isDirectory: false,
        resumeData: "private-os-resume",
      };
    }
    release() {}
    finish(text: string) {
      files.set(this.file.uri, text);
      this.state = "completed";
      this.options.onProgress({ bytesWritten: Buffer.byteLength(text) });
      this.resolve(this.file);
    }
    static fromSavable(state: any, options: any) {
      const task = new Task(state.url, new File(state.fileUri), options);
      task.state = "paused";
      return task;
    }
  }
  const data = JSON.stringify({ questions: [{ id: 1 }] }),
    hash = createHash("sha256").update(data).digest("hex");
  const manifest = {
    version: "one",
    bundle: { id: "b", title: "Bank" },
    parts: [hash, "b".repeat(64)].map((h, i) => ({
      hash: h,
      count: 1,
      bytes: Buffer.byteLength(data),
      subject: "Maths",
      year: "2024",
      paper: "one",
      offset: i,
    })),
  };
  const api: any = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/downloadTransport.native.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports: api,
      Error,
      Date,
      Promise,
      Map,
      Set,
      require: (name: string) => {
        if (name === "expo-file-system")
          return {
            File,
            Directory,
            DownloadTask: Task,
            Paths: { cache: "cache" },
          };
        if (name === "expo-crypto")
          return {
            CryptoDigestAlgorithm: { SHA256: "sha256" },
            digestStringAsync: async (_: string, text: string) =>
              createHash("sha256").update(text).digest("hex"),
          };
        if (name === "react-native") return { Platform: { OS: "ios" } };
        if (name === "../storage/records")
          return {
            read: async (o: string, k: string, id: string) =>
              values.get(JSON.stringify([o, k, id])),
            write: async (o: string, k: string, id: string, v: any) =>
              values.set(JSON.stringify([o, k, id]), v),
            remove: async (o: string, k: string, id: string) =>
              values.delete(JSON.stringify([o, k, id])),
          };
        if (name === "../storage/bank")
          return { hasIndexPart: async () => false };
        if (name === "./api")
          return { apiUrl: (p: string) => "https://example.test" + p };
        if (name === "../domain/cancellation") return { checkCancelled };
        throw Error(name);
      },
    },
  );
  return { api, files, values, tasks, restored, manifest, data, hash };
}
test("native download batch queues later files before the first completes, using a background session", async () => {
  const f = fixture(),
    abort = new AbortController();
  await f.api.prepareParts(
    "alice",
    f.manifest,
    f.manifest.parts.map((p: any) => p.hash),
    abort.signal,
  );
  assert.equal(f.tasks.length, 2);
  assert.ok(
    f.tasks.every(
      (t) => t.state === "active" && t.options.sessionType === "background",
    ),
  );
  const reading = f.api.readPart(
    "alice",
    f.manifest,
    f.manifest.parts[0],
    abort.signal,
    () => {},
  );
  f.tasks[0].finish(f.data);
  assert.equal(await reading, f.data);
  await f.api.pauseParts("alice", f.manifest);
});
test("pause state survives runtime restart and iOS resume does not require the final destination to exist", async () => {
  const first = fixture(),
    abort = new AbortController();
  await first.api.prepareParts(
    "alice",
    first.manifest,
    [first.hash],
    abort.signal,
  );
  await first.api.pauseParts("alice", first.manifest);
  assert.equal(first.values.size, 1);
  const second = fixture(first);
  await second.api.prepareParts(
    "alice",
    second.manifest,
    [second.hash],
    abort.signal,
  );
  assert.equal(second.restored.length, 1);
  const reading = second.api.readPart(
    "alice",
    second.manifest,
    second.manifest.parts[0],
    abort.signal,
    () => {},
  );
  second.tasks[0].finish(second.data);
  assert.equal(await reading, second.data);
  await second.api.forgetParts("alice", second.manifest, [second.hash]);
  assert.equal(second.values.size, 0);
  assert.equal(second.files.size, 0);
});
test("native cached files are hash checked and corrupt bytes are discarded before retry", async () => {
  const f = fixture(),
    abort = new AbortController();
  await f.api.prepareParts("alice", f.manifest, [f.hash], abort.signal);
  const first = f.api.readPart(
    "alice",
    f.manifest,
    f.manifest.parts[0],
    abort.signal,
    () => {},
  );
  f.tasks[0].finish("invalid");
  await assert.rejects(first, /verification/);
  assert.equal(f.files.size, 0);
  const second = f.api.readPart(
    "alice",
    f.manifest,
    f.manifest.parts[0],
    abort.signal,
    () => {},
  );
  await new Promise((resolve) => setImmediate(resolve));
  f.tasks[1].finish(f.data);
  assert.equal(await second, f.data);
});
test("temporary file paths and pause records are isolated per account", async () => {
  const f = fixture(),
    abort = new AbortController();
  await f.api.prepareParts("alice", f.manifest, [f.hash], abort.signal);
  await f.api.prepareParts("bob", f.manifest, [f.hash], abort.signal);
  assert.notEqual(f.tasks[0].file.uri, f.tasks[1].file.uri);
  await f.api.pauseParts("alice", f.manifest);
  assert.equal(f.tasks[1].state, "active");
  await f.api.pauseParts("bob", f.manifest);
  assert.equal(f.values.size, 2);
});

test("reopening a download does not duplicate native transfer or pause requests", async () => {
  const f = fixture(),
    c = new AbortController();
  await Promise.all([
    f.api.prepareParts("alice", f.manifest, [f.hash], c.signal),
    f.api.prepareParts("alice", f.manifest, [f.hash], c.signal),
  ]);
  assert.equal(f.tasks.length, 1);
  await Promise.all([
    f.api.pauseParts("alice", f.manifest),
    f.api.pauseParts("alice", f.manifest),
  ]);
  assert.equal(f.tasks[0].pauseCount, 1);
});
