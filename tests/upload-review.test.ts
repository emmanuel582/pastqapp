import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUploadQuestion,
  uploadQuestionIssues,
  applyUploadEdit,
  uploadStage,
  hasOpenUploadChecks,
} from "../src/domain/uploadReview";
import { isWrittenQuestion } from "../src/domain/theory";
import { answerIndex } from "../src/domain/examSession";
import type { Question } from "../src/domain/types";
const q: Question = {
  id: 43,
  subject: "Biology",
  question: "Explain the role of the nucleus.",
  type: "other",
  options: [],
  correct: null,
  explanation: "",
  needsReview: false,
};
test("unknown extracted questions cannot bypass checks simply because options are absent", () => {
  assert.equal(
    uploadQuestionIssues(normalizeUploadQuestion(q))[0],
    "Choose a question type",
  );
  assert.equal(
    uploadStage({ status: "completed", questions: [q] }),
    "attention",
  );
  const fixed = applyUploadEdit({ ...q, type: "theory" });
  assert.deepEqual(uploadQuestionIssues(fixed), []);
  assert.equal(fixed.needsReview, false);
  assert.equal(
    uploadStage({ status: "completed", questions: [fixed] }),
    "review",
  );
});
test("student edits remove empty options and remap the existing answer without inventing a key", () => {
  const raw = {
    ...q,
    type: "single_choice",
    options: ["first", "", "third"],
    correct: "2",
  };
  const fixed = applyUploadEdit(raw);
  assert.deepEqual(fixed.options, ["first", "third"]);
  assert.equal(fixed.correct, 1);
  const unknown = applyUploadEdit({ ...raw, correct: 1 });
  assert.equal(unknown.correct, null);
  assert.equal(answerIndex(unknown), null);
});
test("open clarification takes precedence over completed extraction; approved materials stay completed", () => {
  const followUps = [
    {
      id: "f",
      status: "open",
      type: "unclear_image",
      message: "Add a clearer page",
    },
  ];
  assert.equal(hasOpenUploadChecks({ followUps }), true);
  assert.equal(
    uploadStage({
      status: "completed_with_errors",
      questions: [{ ...q, type: "theory" }],
      followUps,
    }),
    "attention",
  );
  assert.equal(
    uploadStage({
      status: "completed",
      approvedAt: "2026-10-25T00:00:00Z",
      questions: [q],
      followUps,
    }),
    "completed",
  );
  assert.equal(
    uploadStage({ status: "completed", questionCount: 12, openChecks: 2 }),
    "attention",
  );
  assert.equal(
    uploadStage({ status: "completed", questionCount: 12, openChecks: 0 }),
    "review",
  );
});
test("all supported written formats remain ungraded and use the writing interface", () => {
  for (const type of [
    "theory",
    "short_answer",
    "long_answer",
    "essay",
    "structured",
    "fill_blank",
  ]) {
    const written = { ...q, type };
    assert.equal(isWrittenQuestion(written), true);
    assert.equal(answerIndex(written), null);
    assert.deepEqual(uploadQuestionIssues(written), []);
  }
});
test("invalid answer keys and metadata are explained before the server is called", () => {
  const choice = {
    ...q,
    type: "single_choice",
    options: ["one", "two"],
    correct: 7,
  };
  assert.ok(uploadQuestionIssues(choice).includes("Choose a valid answer key"));
  assert.ok(
    uploadQuestionIssues({ ...choice, correct: 0, topic: ["bad"] }).includes(
      "Check topic",
    ),
  );
});
