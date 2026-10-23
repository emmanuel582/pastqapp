import { nativeBankFixture as harness } from "./helpers/nativeBank";
import test from "node:test";
import assert from "node:assert/strict";

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
