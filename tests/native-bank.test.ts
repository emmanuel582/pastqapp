import { practiceKey } from "../src/domain/contracts";
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import vm from "node:vm";
import fs from "node:fs";
function harness() {
  const sqlite = new DatabaseSync(":memory:");
  const adapter = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
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
  const values = new Map<string, unknown>(),
    records = {
      read: async (o: string, k: string, id: string) =>
        values.get(JSON.stringify([o, k, id])) || null,
      write: async (o: string, k: string, id: string, v: any) => {
        values.set(JSON.stringify([o, k, id]), v);
      },
    };
  const compiled = ts.transpileModule(
    fs.readFileSync("src/storage/bank.native.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exported: any = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    require: (path: string) =>
      path === "../domain/contracts"
        ? { practiceKey }
        : path === "./records.native"
          ? { database: async () => adapter, mutate: (work: any) => work() }
          : path === "./records"
            ? records
            : (() => {
                throw Error(path);
              })(),
    console,
  });
  return { bank: exported, sqlite };
}
test("native download lifecycle uses real SQLite: stage, commit, search, hydrate, update and owner isolation", async () => {
  const { bank, sqlite } = harness(),
    hash = "a".repeat(64),
    asset = "b".repeat(64),
    bundle = { id: "chemistry", title: "My chemistry", questions: [] },
    part = { hash, count: 2, offset: 0 };
  const q = {
    id: 1,
    subject: "Chemistry",
    topic: "Atomic structure",
    year: "2024",
    question: "What is a proton?",
    options: ["Positive", "Negative"],
    correct: 0,
    explanation: "",
    questionHtml: '<img src="pastq-asset:' + asset + '">',
  };
  await bank.indexPart("alice", bundle, "v1", part, {
    questions: [q, { ...q, id: 2, question: "What is an electron?" }],
    assets: { [asset]: { mime: "image/png", data: "AAAA" } },
  });
  assert.equal(
    await bank.readIndex("alice", bundle.id),
    null,
    "staging is not visible as a complete download",
  );
  await bank.commitIndex("alice", bundle, "v1", [hash], 2, 200, false);
  const index = await bank.readIndex("alice", bundle.id);
  assert.equal(index.questions.length, 2);
  assert.equal(index.questions[0].question, "");
  const found = await bank.searchIndex("alice", bundle, "PROTON");
  assert.equal(found.length, 1);
  assert.equal(found[0].question, q.question);
  assert.equal(
    (await bank.searchIndex("alice", bundle, "atomic 2024")).length,
    2,
  );
  assert.equal((await bank.searchIndex("bob", bundle, "proton")).length, 0);
  const full = await bank.resolveQuestion("alice", index.questions[0]);
  assert.equal(full.question.question, q.question);
  assert.equal(full.assets[asset].data, "AAAA");
  await assert.rejects(() => bank.resolveQuestion("bob", index.questions[0]));
  await bank.indexPart("alice", bundle, "v2", part, {
    questions: [{ ...q, question: "Updated wording" }],
    assets: {},
  });
  assert.equal(
    (await bank.readIndex("alice", bundle.id)).questions.length,
    2,
    "an incomplete new revision preserves the previous saved bank",
  );
  assert.equal(
    (await bank.resolveQuestion("alice", index.questions[0])).question.question,
    q.question,
    "old question snapshots remain valid",
  );
  await bank.removeIndex("bob", bundle.id);
  assert.equal(
    (await bank.resolveQuestion("alice", index.questions[0])).question.question,
    q.question,
  );
  await bank.removeIndex("alice", bundle.id);
  await assert.rejects(() => bank.resolveQuestion("alice", index.questions[0]));
  sqlite.close();
});
