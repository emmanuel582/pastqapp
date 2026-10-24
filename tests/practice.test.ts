import test from "node:test";
import assert from "node:assert/strict";
import {
  createAttempt,
  remainingSeconds,
  patchAnswer,
  completeAttempt,
  attemptSummary,
} from "../src/domain/attempt";
import {
  answerIndex,
  calculate,
  sessionSummary,
} from "../src/domain/examSession";
import { sessionDurationSeconds } from "../src/domain/sessionDuration";
import {
  defaultSubjectSettings,
  buildSubjectSession,
} from "../src/domain/subjectSession";
import { validateBackup } from "../src/domain/backup";
import { previewBundle } from "./fixtures/questions";
test("deadline survives background time and a serialized restart", () => {
  const a = createAttempt(
    previewBundle,
    previewBundle.questions,
    120,
    "full",
    "owner",
    "id",
    1000,
  );
  assert.equal(remainingSeconds(JSON.parse(JSON.stringify(a)), 61000), 60);
  assert.equal(remainingSeconds(a, 150000), 0);
  assert.equal(completeAttempt(a, 150000).completedAt, 121000);
});
test("invalid answer indexes never corrupt saved choices", () => {
  const a = createAttempt(
    previewBundle,
    previewBundle.questions,
    60,
    "practice",
    "owner",
    "id",
    0,
  );
  assert.equal(patchAnswer(a, 0, 100), a);
  assert.equal(patchAnswer(a, 0, -1), a);
  assert.equal(patchAnswer(a, 0, 0).answers[0], 0);
});
test("unknown keys stay ungraded and are excluded from score denominator", () => {
  const q = {
    subject: "Math",
    question: "Unknown key",
    options: ["a", "b"],
    correct: null,
    explanation: "",
  };
  assert.equal(answerIndex(q), null);
  assert.deepEqual(sessionSummary([previewBundle.questions[0], q], [0, 1]), {
    correct: 1,
    incorrect: 0,
    skipped: 0,
    ungraded: 1,
    graded: 1,
    answered: 2,
    percent: 100,
  });
});
test("written theory answers count once and are never auto-marked", () => {
  const q = {
    ...previewBundle.questions[0],
    type: "theory",
    options: [],
    correct: null,
  };
  let a = createAttempt(
    { ...previewBundle, questions: [q] },
    [q],
    60,
    "practice",
    "owner",
    "id",
    0,
  );
  a = { ...a, written: ["my working"] };
  assert.equal(attemptSummary(a).answered, 1);
  assert.equal(attemptSummary(a).percent, null);
  a = { ...a, answers: [0] };
  assert.equal(attemptSummary(a).answered, 1);
});
test("per-subject selection keeps paper years and allocations separate", () => {
  const english = [
      { ...previewBundle.questions[0], year: "2024", paper: "2024" },
      { ...previewBundle.questions[0], id: 4, year: "2025", paper: "2025" },
    ],
    math = [previewBundle.questions[1]];
  const settings = {
    English: { ...defaultSubjectSettings(english), count: "1" },
    Mathematics: { ...defaultSubjectSettings(math), count: "1" },
  };
  const result = buildSubjectSession(
    ["English", "Mathematics"],
    { English: english, Mathematics: math },
    settings,
    false,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].year, "2025");
  assert.equal(result[1].subject, "Mathematics");
});
test("calculator handles precedence and rejects executable input", () => {
  assert.equal(calculate("2+3×4"), "14");
  for (const scientific of [
    "sin(30)",
    "cos(60)",
    "sqrt(4)",
    "2^3",
    "10%",
    "pi",
  ])
    assert.throws(() => calculate(scientific));
  assert.equal(calculate("−2.5×(4+2)÷3"), "-5");
  assert.throws(() => calculate("globalThis.alert(1)"));
  assert.throws(() => calculate("1/0"));
});
test("time input rejects empty, zero and overflow minutes", () => {
  assert.equal(sessionDurationSeconds("0", "0"), null);
  assert.equal(sessionDurationSeconds("1", "60"), null);
  assert.equal(sessionDurationSeconds("2", "0"), 7200);
});
test("backup validation rejects another owner and incomplete answer arrays", () => {
  const a = createAttempt(
    previewBundle,
    previewBundle.questions,
    60,
    "full",
    "owner",
    "id",
    1000,
  );
  const raw = {
    format: "pastq-native-study-backup",
    version: 1,
    owner: "owner",
    createdAt: new Date().toISOString(),
    attempts: [a],
    bookmarks: [],
  };
  assert.equal(validateBackup(raw, "owner").attempts.length, 1);
  assert.throws(() => validateBackup(raw, "another"));
  assert.throws(() =>
    validateBackup({ ...raw, attempts: [{ ...a, answers: [] }] }, "owner"),
  );
});
