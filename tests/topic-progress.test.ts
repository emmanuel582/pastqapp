import test from "node:test";
import assert from "node:assert/strict";
import {
  progressSession,
  topicProgress,
  topicAdvice,
  topicPracticePaper,
  topicId,
} from "../src/domain/topicProgress";
import { createAttempt, completeAttempt } from "../src/domain/attempt";
import type { Question } from "../src/domain/types";
function sample(id: string, answers: (number | null)[], at: number) {
  const questions: Question[] = answers.map((_, i) => ({
    id: i,
    subject: "Mathematics",
    topic: "Fractions",
    question: "Question " + i,
    explanation: "",
    options: ["a", "b"],
    correct: 0,
  }));
  return completeAttempt(
    {
      ...createAttempt(
        { id: "bank", title: "Maths", questions },
        questions,
        600,
        "practice",
        "alice",
        id,
        at - 1000,
      ),
      answers,
    },
    at,
  );
}
test("topic scores count correct, wrong and skipped without marking unknown/theory answers wrong", () => {
  const a = sample("a", [0, 1, null, null], 10000);
  a.questions[3].correct = null;
  const s = progressSession(a)!;
  const row = topicProgress([s, s])[0];
  assert.equal(row.total, 4);
  assert.equal(row.graded, 3);
  assert.equal(row.correct, 1);
  assert.equal(row.wrong, 1);
  assert.equal(row.skipped, 1);
  assert.equal(row.ungraded, 1);
  assert.equal(row.percent, 33);
  assert.equal(row.sessions, 1);
  assert.equal(topicAdvice(row), "Try a few more questions");
});
test("topic progress separates subjects, orders trends by time and filters by completion date", () => {
  const first = sample("first", [1, 1, 1, 0, 0], 10000),
    last = sample("last", [0, 0, 0, 0, 1], 20000);
  last.questions.push({ ...last.questions[0], subject: "Physics" });
  last.answers.push(0);
  const rows = topicProgress([progressSession(last)!, progressSession(first)!]);
  assert.equal(rows.length, 2);
  const maths = rows.find((r) => r.subject === "Mathematics")!;
  assert.equal(maths.percent, 60);
  assert.deepEqual(
    maths.points.map((p) => p.percent),
    [40, 80],
  );
  assert.equal(
    topicProgress(
      [progressSession(first)!, progressSession(last)!],
      15000,
    ).find((r) => r.subject === "Mathematics")!.percent,
    80,
  );
});
test("one-topic practice is offline, deduplicated, missed-first and never includes theory or another subject", () => {
  const a = sample("old", [0, 1, null], 10000),
    b = sample("new", [0, 0, 1], 20000);
  b.questions[0].topic = "Algebra";
  a.questions.push({
    ...a.questions[0],
    id: 99,
    type: "theory",
    options: [],
    correct: null,
  });
  a.answers.push(null);
  const paper = topicPracticePaper(
    [a, b],
    topicId("Mathematics", "Fractions"),
  )!;
  assert.equal(paper.questions.length, 3);
  assert.equal(paper.questions[0].id, 2);
  assert.ok(
    paper.questions.every(
      (q) => q.topic === "Fractions" && q.type !== "theory",
    ),
  );
  assert.equal(topicPracticePaper([a], topicId("Physics", "Fractions")), null);
});
test("active sessions do not affect topic progress", () => {
  const a = sample("a", [1], 10000);
  a.status = "active";
  assert.equal(progressSession(a), null);
});
