import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(file: string, deps: Record<string, unknown>) {
  const exports: any = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name: string) => {
        if (!(name in deps)) throw Error(name);
        return deps[name];
      },
    },
  );
  return exports;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
function reminders() {
  const outbox = new Map<string, unknown>(),
    sent: { owner: string; settings: any }[] = [];
  let work: () => Promise<void> = async () => {};
  const api = load("src/services/reminders.ts", {
    "../storage/records": { read: async (owner: string) => outbox.get(owner) },
    "./api": {
      json: (method: string, body: unknown) => ({
        method,
        body: JSON.stringify(body),
      }),
      request: async (_path: string, opts: any, auth: boolean) => {
        assert.equal(auth, true);
        const settings = JSON.parse(opts.body);
        sent.push({ owner: opts.owner, settings });
        await work();
        return { settings };
      },
    },
    "../domain/reminders": {},
  });
  return { api, outbox, sent, work: (fn: typeof work) => (work = fn) };
}
test("manual reminder saves wait for older background requests so the latest settings win", async () => {
  const f = reminders(),
    old = { enabled: true, time: "18:00" },
    next = { enabled: false, time: "19:00" },
    started = deferred(),
    resume = deferred();
  f.outbox.set("alice", old);
  let first = true;
  f.work(async () => {
    if (first) {
      first = false;
      started.resolve();
      await resume.promise;
    }
  });
  const one = f.api.saveReminders("alice", old);
  await started.promise;
  f.outbox.set("alice", next);
  const two = f.api.saveReminders("alice", next);
  assert.equal(f.sent.length, 1);
  resume.resolve();
  await Promise.all([one, two]);
  assert.deepEqual(f.sent, [
    { owner: "alice", settings: old },
    { owner: "alice", settings: next },
  ]);
});
test("an obsolete queued reminder snapshot is never sent", async () => {
  const f = reminders();
  f.outbox.set("alice", { time: "20:00" });
  await assert.rejects(
    () => f.api.saveReminders("alice", { time: "18:00" }),
    /settings changed/,
  );
  assert.equal(f.sent.length, 0);
});
test("reminder queues are independent between accounts and preserve the owner", async () => {
  const f = reminders(),
    started = deferred(),
    resume = deferred();
  f.outbox.set("alice", { time: "18:00" });
  f.outbox.set("bob", { time: "19:00" });
  f.work(async () => {
    if (f.sent.at(-1)?.owner === "alice") {
      started.resolve();
      await resume.promise;
    }
  });
  const alice = f.api.saveReminders("alice", { time: "18:00" });
  await started.promise;
  await f.api.saveReminders("bob", { time: "19:00" });
  resume.resolve();
  await alice;
  assert.deepEqual(
    f.sent.map((x) => x.owner),
    ["alice", "bob"],
  );
});
test("an acknowledgement cannot erase a newer offline reminder edit", async () => {
  const old = { enabled: true, time: "18:00" },
    next = { enabled: false, time: "19:00" };
  let pending: any = old;
  const api = load("src/services/sync.ts", {
    "../storage/records": {
      read: async (_o: string, kind: string) =>
        kind === "reminder-outbox" ? pending : null,
      compareAndSwap: async (
        _o: string,
        _k: string,
        _id: string,
        expected: any,
      ) => {
        if (JSON.stringify(expected) === JSON.stringify(pending))
          pending = null;
      },
    },
    "./history": { syncHistory: async () => {} },
    "./reports": { syncReports: async () => {} },
    "./reminders": {
      saveReminders: async (owner: string) => {
        assert.equal(owner, "alice");
        pending = next;
      },
    },
    "./notifications": {},
    "../storage/practice": { listAttempts: async () => [] },
    "./api": {},
  });
  await api.syncAccount("alice");
  assert.deepEqual(pending, next);
});
