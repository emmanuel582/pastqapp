import test from "node:test";
import assert from "node:assert/strict";
import { createAttempt } from "../src/domain/attempt";
import { previewBundle } from "../src/data/preview";
import { reviewQuestions, questionNumberLabel } from "../src/domain/review";
import { examCountdown, formatTime } from "../src/domain/examClock";
test("result boxes jump to correct, wrong, unanswered and ungraded original question numbers", () => {
  const questions = [
    ...previewBundle.questions,
    {
      subject: "Theory",
      question: "Explain",
      options: [],
      correct: null,
      explanation: "",
      type: "theory",
    },
  ];
  const a = createAttempt(
    previewBundle,
    questions,
    1200,
    "full",
    "owner",
    "review",
  );
  a.answers = [0, 0, null, null];
  a.written = ["", "", "", "My reasoning"];
  assert.deepEqual(reviewQuestions(a, "correct"), [0]);
  assert.deepEqual(reviewQuestions(a, "incorrect"), [1]);
  assert.deepEqual(reviewQuestions(a, "skipped"), [2]);
  assert.deepEqual(reviewQuestions(a, "reviewed"), [3]);
  assert.deepEqual(reviewQuestions(a), [0, 1, 2, 3]);
  assert.equal(
    questionNumberLabel(a, 1, true),
    "Question 2, Mathematics, Wrong",
  );
  assert.equal(
    questionNumberLabel(a, 1, false),
    "Question 2, Mathematics, Answered",
  );
  assert.ok(!questionNumberLabel(a, 0, false).includes("Correct"));
});
test("real countdown catches missed seconds, resumes from the deadline and expires once", () => {
  let now = 0,
    expired = 0;
  const values: number[] = [];
  const tick = examCountdown(
    120000,
    (n) => values.push(n),
    () => expired++,
    () => now,
  );
  assert.equal(tick(), 120);
  now = 1001;
  assert.equal(tick(), 119);
  now = 67005;
  assert.equal(tick(), 53);
  now = 125000;
  assert.equal(tick(), 0);
  tick();
  assert.equal(expired, 1);
  assert.deepEqual(values, [120, 119, 53, 0, 0]);
  const fresh = examCountdown(
    126000,
    () => {},
    () => expired++,
    () => now,
  );
  assert.equal(fresh(), 1);
  now = 126000;
  fresh();
  assert.equal(expired, 2);
  assert.equal(formatTime(120), "02:00");
  assert.equal(formatTime(-5), "00:00");
  assert.equal(formatTime(NaN), "00:00");
});
