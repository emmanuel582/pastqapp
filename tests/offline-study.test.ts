import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import * as attempts from "../src/domain/attempt";
import * as working from "../src/domain/working";
import * as backupDomain from "../src/domain/backup";
import { cachedStudySession } from "../src/domain/offline";
import { historyDays, mergeHistory } from "../src/domain/history";
import { previewBundle } from "../src/data/preview";
function storageHarness(sqlite = new DatabaseSync(":memory:")) {
  const adapter: any = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    runAsync: async (sql: string, ...params: any[]) =>
      sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: any[]) =>
      sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: any[]) =>
      sqlite.prepare(sql).get(...params) || null,
    withExclusiveTransactionAsync: async (work: any) => {
      sqlite.exec("BEGIN");
      try {
        await work(adapter);
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const modules = new Map<string, any>();
  function load(file: string): any {
    const full = path.resolve(file);
    if (modules.has(full)) return modules.get(full);
    const exports: any = {};
    modules.set(full, exports);
    const code = ts.transpileModule(fs.readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      Date,
      Map,
      Set,
      Promise,
      console,
      fetch: () => {
        throw Error("Network is disabled for offline checks");
      },
      require: (name: string) => {
        if (name === "expo-sqlite")
          return { openDatabaseAsync: async () => adapter };
        if (name === "expo-crypto")
          return {
            CryptoDigestAlgorithm: { SHA256: "sha256" },
            digestStringAsync: async (_: string, text: string) =>
              createHash("sha256").update(text).digest("hex"),
          };
        if (name === "./records" || name === "../storage/records")
          return load("src/storage/records.native.ts");
        if (name === "./bank" || name === "../storage/bank")
          return {
            resolveQuestion: async (_: string, q: any) => ({
              question: q,
              assets: undefined,
            }),
          };
        if (name === "../domain/attempt") return attempts;
        if (name === "../domain/working") return working;
        if (name === "../domain/backup") return backupDomain;
        if (name.startsWith("."))
          return load(path.resolve(path.dirname(full), name + ".ts"));
        throw Error("Unexpected dependency " + name);
      },
    });
    return exports;
  }
  return {
    sqlite,
    records: load("src/storage/records.native.ts"),
    practice: load("src/storage/practice.ts"),
    papers: load("src/storage/working.ts"),
    backup: load("src/services/backup.ts"),
  };
}
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const makeAttempt = (id = "offline-1", owner = "alice") =>
  attempts.createAttempt(
    previewBundle,
    previewBundle.questions,
    1200,
    "practice",
    owner,
    id,
    Date.now(),
  );
const ink = (x = 10) => ({
  version: 1 as const,
  strokes: [
    {
      erase: false,
      size: 3,
      points: [
        { x, y: 20 },
        { x: x + 50, y: 80 },
      ],
    },
  ],
});
test("offline SQLite journey retains answers and question working after restart and completion", async () => {
  const first = storageHarness();
  let attempt = makeAttempt();
  await first.practice.saveAttempt(attempt, true);
  await first.papers.saveWorkingPaper("alice", attempt.id, 0, ink());
  assert.equal(
    (await first.papers.readWorkingPaper("alice", attempt.id, 1)).strokes
      .length,
    0,
  );
  await first.papers.saveWorkingPaper("alice", attempt.id, 1, ink(100));
  attempt = attempts.patchAnswer(attempt, 0, 2);
  await first.practice.saveAttempt(attempt);
  const reopened = storageHarness(first.sqlite);
  const saved = await reopened.practice.readAttempt("alice", attempt.id);
  assert.equal(saved.answers[0], 2);
  assert.equal(saved.questions.length, 3);
  assert.deepEqual(
    plain(
      (await reopened.papers.readWorkingPaper("alice", attempt.id, 0)).strokes,
    ),
    ink().strokes,
  );
  assert.deepEqual(
    plain(
      (await reopened.papers.readWorkingPaper("alice", attempt.id, 1)).strokes,
    ),
    ink(100).strokes,
  );
  assert.equal(
    (await reopened.papers.readWorkingPaper("bob", attempt.id, 0)).strokes
      .length,
    0,
  );
  await reopened.practice.saveAttempt(attempts.completeAttempt(saved));
  const header = await reopened.records.read("alice", "attempt", attempt.id);
  assert.equal(header.topicProgress.topics.length, 3);
  assert.equal(
    header.topicProgress.topics.find((t: any) => t.topic === "Vocabulary")
      .wrong,
    1,
  );
  await assert.rejects(
    reopened.papers.saveWorkingPaper("alice", attempt.id, 0, ink(300)),
    /unfinished/,
  );
  assert.deepEqual(
    plain(
      (await reopened.papers.readWorkingPaper("alice", attempt.id, 0)).strokes,
    ),
    ink().strokes,
  );
  first.sqlite.close();
});
test("offline deletion removes saved papers, working and outboxes atomically without resurrection or cross-owner loss", async () => {
  const f = storageHarness(),
    attempt = makeAttempt();
  await f.practice.saveAttempt(attempt, true);
  await f.papers.saveWorkingPaper("alice", attempt.id, 0, ink());
  await f.practice.saveAttempt(attempts.completeAttempt(attempt));
  await f.records.write("alice", "bundle-meta", attempt.bundleId, {
    saved: true,
  });
  await f.records.write("bob", "attempt", attempt.id, { untouched: true });
  const deleted = f.practice.deleteAttempt("alice", attempt.id),
    stale = f.practice.saveAttempt(attempts.completeAttempt(attempt));
  await deleted;
  await assert.rejects(stale, /deleted/);
  for (const kind of [
    "attempt",
    "attempt-paper",
    "history-outbox",
    "cohort-outbox",
  ])
    assert.equal(await f.records.read("alice", kind, attempt.id), null);
  assert.equal(
    (await f.records.list("alice", "working:" + attempt.id)).length,
    0,
  );
  assert.equal(
    (await f.records.read("bob", "attempt", attempt.id)).untouched,
    true,
  );
  assert.equal(
    (await f.records.read("alice", "bundle-meta", attempt.bundleId)).saved,
    true,
  );
  const hidden = await f.practice.deletedAttemptIds("alice");
  assert.equal(
    mergeHistory(
      [],
      [
        {
          id: attempt.id,
          title: "Synced result",
          score: 1,
          total_questions: 3,
          completed_at: new Date().toISOString(),
        },
      ],
      hidden,
    ).length,
    0,
  );
  await assert.rejects(f.practice.readAttempt("alice", attempt.id), /deleted/);
  f.sqlite.close();
});
test("native deletion transaction rolls back every change if storage fails", async () => {
  const f = storageHarness();
  await f.records.write("alice", "attempt-paper", "keep", { questions: [1] });
  const invalid: any = {};
  invalid.self = invalid;
  await assert.rejects(
    f.records.commit("alice", [
      { kind: "attempt-paper", id: "keep", remove: true },
      { kind: "bad", id: "fail", value: invalid },
    ]),
  );
  assert.equal(
    (await f.records.read("alice", "attempt-paper", "keep")).questions[0],
    1,
  );
  f.sqlite.close();
});
test("backups round-trip question working offline and explicit restoration can recover a deleted session", async () => {
  const f = storageHarness(),
    a = makeAttempt();
  await f.practice.saveAttempt(a, true);
  await f.papers.saveWorkingPaper("alice", a.id, 0, ink());
  const text = await f.backup.exportBackup("alice");
  assert.equal(JSON.parse(text).workingPapers.length, 1);
  await f.practice.discardAttempt("alice", a.id);
  await f.backup.importBackup("alice", text);
  assert.equal((await f.practice.deletedAttemptIds("alice")).size, 0);
  assert.deepEqual(
    plain((await f.papers.readWorkingPaper("alice", a.id, 0)).strokes),
    ink().strokes,
  );
  const raw = JSON.parse(text);
  raw.workingPapers[0].questionIndex = 999;
  assert.throws(
    () => backupDomain.validateBackup(raw, "alice"),
    /invalid question/,
  );
  assert.throws(
    () => backupDomain.validateBackup(JSON.parse(text), "bob"),
    /another account/,
  );
  f.sqlite.close();
});
test("local day review groups today and yesterday across midnight and sorts sessions within each day", () => {
  const now = new Date(2026, 9, 23, 0, 15);
  const rows = [
    new Date(2026, 9, 22, 23, 55),
    new Date(2026, 9, 23, 0, 2),
    new Date(2026, 9, 21, 12),
  ].map((date, i) => ({
    id: String(i),
    title: "Session",
    completedAt: date.getTime(),
    percent: 33,
    local: true,
    correct: 1,
    total: 3,
  }));
  const days = historyDays(rows, now);
  assert.equal(days[0].title, "Today");
  assert.equal(days[1].title, "Yesterday");
  assert.equal(days[0].data[0].id, "1");
  assert.equal(days.length, 3);
});
test("offline launch accepts a previously stored expired session without network access and rejects malformed storage", () => {
  const cached = {
    user: { id: "alice" },
    access_token: "expired-local-token",
    refresh_token: "stored-refresh",
    expires_at: 1,
  };
  assert.equal(cachedStudySession(JSON.stringify(cached))?.user.id, "alice");
  assert.equal(cachedStudySession("{bad"), null);
  assert.equal(
    cachedStudySession(JSON.stringify({ user: { id: "alice" } })),
    null,
  );
});
test("long drawing gestures remain bounded, keep their end and reject corrupt backup points", () => {
  const stroke: working.WorkingStroke = {
    points: [{ x: 0, y: 0 }],
    erase: false,
    size: 3,
  };
  for (let i = 0; i < 12000; i++)
    working.appendWorkingPoint(stroke, { x: i % 800, y: i % 700 });
  working.appendWorkingPoint(stroke, { x: 11999 % 800, y: 11999 % 700 }, true);
  assert.ok(stroke.points.length <= 4096);
  assert.deepEqual(stroke.points.at(-1), { x: 11999 % 800, y: 11999 % 700 });
  assert.deepEqual(working.workingPoint(-5, 900, 100, 100), { x: 0, y: 700 });
  assert.throws(
    () =>
      working.validateWorkingPaper({
        version: 1,
        strokes: [{ ...stroke, points: [{ x: Infinity, y: 0 }] }],
      }),
    /invalid/,
  );
});
