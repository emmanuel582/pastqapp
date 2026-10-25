import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { abortTransfer } from "../src/domain/cancellation";
function load(
  path: string,
  deps: Record<string, any>,
  extra: Record<string, any> = {},
) {
  const exports: any = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      JSON,
      require: (name: string) => {
        if (!(name in deps)) throw Error(name);
        return deps[name];
      },
      AbortController,
      setTimeout,
      clearTimeout,
      ...extra,
    },
  );
  return exports;
}
test("SQLite acknowledgements never erase newer uploads or another account's draft", async () => {
  const db = new DatabaseSync(":memory:");
  const adapter = {
    execAsync: async (s: string) => db.exec(s),
    runAsync: async (s: string, ...p: any[]) => db.prepare(s).run(...p),
    getFirstAsync: async (s: string, ...p: any[]) => db.prepare(s).get(...p),
  };
  const records = load("src/storage/records.native.ts", {
    "expo-sqlite": { openDatabaseAsync: async () => adapter },
  });
  try {
    const old = { files: ["first"], started: true },
      next = { files: ["second"] };
    await records.write("alice", "upload", "draft", old);
    await records.write("bob", "upload", "draft", old);
    assert.equal(
      await records.compareAndSwap("alice", "upload", "draft", old, {
        ...old,
        sessionId: "one",
      }),
      true,
    );
    await records.write("alice", "upload", "draft", next);
    assert.equal(
      await records.compareAndSwap(
        "alice",
        "upload",
        "draft",
        { ...old, sessionId: "one" },
        null,
      ),
      false,
    );
    assert.deepEqual(await records.read("alice", "upload", "draft"), next);
    assert.deepEqual(await records.read("bob", "upload", "draft"), old);
    assert.equal(
      await records.compareAndSwap("bob", "upload", "draft", old, null),
      true,
    );
    assert.equal(await records.read("bob", "upload", "draft"), null);
  } finally {
    db.close();
  }
});
function background() {
  let owner = "alice",
    task: any,
    expire: any;
  const values = new Map(),
    downloads: string[] = [];
  let upload: () => Promise<string> = async () => {
    throw Error("Offline upload");
  };
  const records = {
    read: async (o: string, k: string, id: string) =>
      values.get(JSON.stringify([o, k, id])),
    list: async (o: string, k: string) =>
      [...values]
        .filter(([key]) => JSON.parse(key)[0] === o && JSON.parse(key)[1] === k)
        .map(([, v]) => v),
    write: async (o: string, k: string, id: string, v: any) => {
      values.set(JSON.stringify([o, k, id]), v);
    },
    compareAndSwap: async (
      o: string,
      k: string,
      id: string,
      expected: any,
      next: any,
    ) => {
      const key = JSON.stringify([o, k, id]);
      if (JSON.stringify(values.get(key)) !== JSON.stringify(expected))
        return false;
      if (next === null) values.delete(key);
      else values.set(key, next);
      return true;
    },
  };
  const api = load("src/services/backgroundTransfers.native.ts", {
    "../domain/cancellation": { abortTransfer },
    "expo-task-manager": {
      defineTask: (_name: string, fn: any) => {
        task = fn;
      },
    },
    "expo-background-task": {
      addExpirationListener: (fn: any) => {
        expire = fn;
        return { remove() {} };
      },
      BackgroundTaskResult: { Success: 1, Failed: 2 },
    },
    "./auth": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: owner } } },
          }),
        },
      },
    },
    "../storage/records": records,
    "./uploadHistory": { rememberPendingUpload: async () => {} },
    "./uploads": {
      uploadMaterial: async (...args: any[]) => {
        await args[4]?.("session");
        return upload();
      },
    },
    "./library": {
      download: async (o: string) => {
        downloads.push(o);
      },
    },
  });
  return {
    api,
    records,
    values,
    downloads,
    task: () => task(),
    expire: () => expire(),
    owner: (value: string) => {
      owner = value;
    },
    upload: (fn: () => Promise<string>) => {
      upload = fn;
    },
  };
}
test("a failed upload does not block pending downloads; explicit pauses remain paused", async () => {
  const f = background();
  await f.records.write("alice", "upload", "draft", {
    started: true,
    files: [{ uri: "one" }],
    name: "one",
  });
  for (const [id, paused] of [
    ["ready", false],
    ["paused", true],
  ])
    await f.records.write("alice", "download-plan", String(id), {
      manifest: { bundle: { id } },
      selected: ["hash"],
      paused,
    });
  await assert.rejects(
    f.api.resumePendingTransfers(new AbortController().signal),
    /Offline upload/,
  );
  assert.deepEqual(f.downloads, ["alice"]);
});
test("finishing an older recovery preserves a newer draft and account recovery is independent", async () => {
  const f = background();
  let finish!: (id: string) => void;
  f.upload(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await f.records.write("alice", "upload", "draft", {
    started: true,
    files: [{ uri: "one" }],
    name: "one",
  });
  const running = f.api.resumePendingTransfers(new AbortController().signal);
  while (!finish) await new Promise((r) => setImmediate(r));
  const newer = { files: [{ uri: "two" }], name: "two" };
  await f.records.write("alice", "upload", "draft", newer);
  f.owner("bob");
  await f.records.write("bob", "download-plan", "bank", {
    manifest: {},
    selected: ["hash"],
  });
  await f.api.resumePendingTransfers(new AbortController().signal);
  assert.deepEqual(f.downloads, ["bob"]);
  finish("session");
  await running;
  assert.deepEqual(await f.records.read("alice", "upload", "draft"), newer);
  assert.equal(
    await f.records.read("alice", "processing", "current"),
    undefined,
  );
});
test("background expiration returns failure without treating expiry as a user pause", async () => {
  const f = background();
  let finish!: (id: string) => void;
  f.upload(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await f.records.write("alice", "upload", "draft", {
    started: true,
    files: [{ uri: "one" }],
    name: "one",
  });
  const task = f.task();
  while (!finish) await new Promise((r) => setImmediate(r));
  f.expire();
  finish("session");
  assert.equal(await task, 2);
});
test("foreground upload and recovery share one session and notify both callers", async () => {
  let requests = 0,
    finish!: () => void;
  const auth = {
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "alice" } } },
        }),
      },
    },
  };
  const api = load("src/services/uploads.ts", {
    "./auth": auth,
    "./multipartFile": { appendUploadFile() {} },
    "../domain/cancellation": {
      checkCancelled: (s: any) => {
        if (s?.aborted) throw Error("aborted");
      },
    },
    "./uploadTransport": {
      transferUpload: () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    },
    "../domain/files": { supportedMaterial: () => true },
    "./api": {
      json: () => ({}),
      request: async () => {
        requests++;
        return { id: "shared", status: "pending" };
      },
    },
  });
  const files = [
      {
        uri: "durable/file.pdf",
        name: "paper.pdf",
        size: 20,
        mimeType: "application/pdf",
      },
    ],
    sessions: string[] = [];
  const first = api.uploadMaterial(
    files,
    "Paper",
    () => {},
    undefined,
    async (id: string) => {
      sessions.push("first:" + id);
    },
  );
  while (!finish) await new Promise((r) => setImmediate(r));
  const second = api.uploadMaterial(
    files,
    "Paper",
    () => {},
    "shared",
    async (id: string) => {
      sessions.push("second:" + id);
    },
  );
  await new Promise((r) => setImmediate(r));
  finish();
  assert.deepEqual(await Promise.all([first, second]), ["shared", "shared"]);
  assert.equal(requests, 1);
  assert.deepEqual(sessions, ["first:shared", "second:shared"]);
});
