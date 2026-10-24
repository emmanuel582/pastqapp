import test from "node:test";
import assert from "node:assert/strict";
import { topicProgress, topicAdvice } from "../src/domain/topicProgress";
test("repeated weak-topic evidence is recommended before a single incorrect answer", () => {
  const rows = topicProgress([
    {
      id: "a",
      completedAt: 100,
      topics: [
        {
          id: "few",
          subject: "Maths",
          topic: "One answer",
          correct: 0,
          wrong: 1,
          skipped: 0,
          ungraded: 0,
          total: 1,
        },
        {
          id: "weak",
          subject: "Maths",
          topic: "Repeated difficulty",
          correct: 1,
          wrong: 5,
          skipped: 0,
          ungraded: 0,
          total: 6,
        },
      ],
    },
  ]);
  assert.equal(rows[0].id, "weak");
  assert.equal(topicAdvice(rows[0]), "Needs practice");
});
