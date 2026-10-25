import test from "node:test";
import assert from "node:assert/strict";
import { reviewQuestions } from "../vps-overlay/services/vision/reviewedMaterials.js";
const question = {
  id: 43,
  type: "other",
  question: "Explain the role of the nucleus.",
  subject: "Biology",
  options: [],
  correct: null,
  explanation: "",
};
const session = () => ({
  status: "completed",
  questions: [question],
  followUps: [],
});
test("unknown type gets an actionable error and the owner can explicitly classify a written question", () => {
  assert.throws(
    () => reviewQuestions(session(), [question]),
    /Question 1: choose CBT or written answer/,
  );
  const result = reviewQuestions(session(), [{ ...question, type: "theory" }]);
  assert.equal(result[0].type, "theory");
  assert.equal(result[0].correct, null);
  assert.equal(result[0].incomplete, false);
});
test("confirmation cannot skip unresolved extraction checks", () => {
  assert.throws(
    () =>
      reviewQuestions({ ...session(), followUps: [{ status: "open" }] }, [
        { ...question, type: "theory" },
      ]),
    /Resolve the upload checks/,
  );
  assert.equal(
    reviewQuestions({ ...session(), followUps: [{ status: "dismissed" }] }, [
      { ...question, type: "theory" },
    ]).length,
    1,
  );
});
test("removing an extraction artefact retains source ownership, unique IDs and at least one real question", () => {
  const other = { ...question, id: 44, type: "theory" };
  const original = { ...session(), questions: [question, other] };
  assert.equal(reviewQuestions(original, [other]).length, 1);
  assert.throws(() => reviewQuestions(original, []), /at least one/);
  assert.throws(
    () => reviewQuestions(original, [{ ...other, id: "foreign" }]),
    /Question 1/,
  );
  assert.throws(() => reviewQuestions(original, [other, other]), /Question 2/);
});
test("an answer key must match actual options and a written question cannot receive a CBT key", () => {
  const original = session();
  assert.throws(
    () =>
      reviewQuestions(original, [
        {
          ...question,
          type: "single_choice",
          options: ["one", "two"],
          correct: 8,
        },
      ]),
    /Question 1/,
  );
  assert.throws(
    () =>
      reviewQuestions(original, [{ ...question, type: "theory", correct: 0 }]),
    /Question 1/,
  );
});
