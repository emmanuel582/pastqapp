import type { Question, VisionSession } from "./types";
import { isWrittenQuestion } from "./theory";
const choiceTypes = new Set(["single_choice", "multiple_choice", "true_false"]);
export function normalizeUploadQuestion(q: Question): Question {
  const raw = q.correct;
  const key =
    typeof raw === "string" && /^\s*\d+\s*$/.test(raw) ? Number(raw) : raw;
  return {
    ...q,
    type: q.type || (q.options?.length >= 2 ? "single_choice" : "other"),
    correct: isWrittenQuestion(q) ? null : key,
  };
}
export function uploadQuestionIssues(q: Question): string[] {
  const errors: string[] = [];
  if (!choiceTypes.has(q.type || "") && !isWrittenQuestion(q))
    errors.push("Choose a question type");
  if (!q.question?.trim()) errors.push("Add the question text");
  else if (q.question.length > 50000) errors.push("Shorten the question text");
  if (
    !Array.isArray(q.options) ||
    (!isWrittenQuestion(q) && q.options.length < 2)
  )
    errors.push("Add at least two options");
  else if (
    q.options.length > 12 ||
    q.options.some(
      (o) => typeof o !== "string" || !o.trim() || o.length > 20000,
    )
  )
    errors.push("Check the answer options");
  if (
    q.correct != null &&
    (!Number.isInteger(q.correct) ||
      Number(q.correct) < 0 ||
      Number(q.correct) >= q.options.length ||
      isWrittenQuestion(q))
  )
    errors.push("Choose a valid answer key");
  for (const field of [
    "subject",
    "year",
    "explanation",
    "topic",
    "answerText",
  ] as const) {
    const value = q[field];
    if (
      field === "year" &&
      Number.isInteger(value) &&
      Number(value) >= 1900 &&
      Number(value) <= 2200
    )
      continue;
    if (
      value != null &&
      (typeof value !== "string" ||
        value.length >
          (["explanation", "answerText"].includes(field) ? 50000 : 300))
    )
      errors.push(
        "Check " + (field === "answerText" ? "the written answer" : field),
      );
  }
  return errors;
}
export function needsQuestionCheck(q: Question): boolean {
  return Boolean(
    q.incomplete || q.needsReview || uploadQuestionIssues(q).length,
  );
}
export function applyUploadEdit(q: Question): Question {
  const normalized = normalizeUploadQuestion(q);
  const kept = normalized.options
    .map((text, index) => ({ text: text.trim(), index }))
    .filter((o) => o.text);
  const key =
    normalized.correct == null
      ? null
      : kept.findIndex((o) => o.index === normalized.correct);
  const next = {
    ...normalized,
    question: normalized.question.trim(),
    options: kept.map((o) => o.text),
    correct: key != null && key >= 0 ? key : null,
    incomplete: false,
    needsReview: false,
    reviewReasons: [],
  };
  const errors = uploadQuestionIssues(next);
  return {
    ...next,
    incomplete: errors.length > 0,
    needsReview: errors.length > 0,
    reviewReasons: errors,
  };
}
export function hasOpenUploadChecks(
  s: Pick<VisionSession, "followUps">,
): boolean {
  return Boolean(s.followUps?.some((f) => f.status === "open"));
}
export type UploadStage =
  "uploading" | "processing" | "attention" | "review" | "completed" | "failed";
export function uploadStage(
  s: Pick<
    VisionSession,
    "status" | "approvedAt" | "followUps" | "questions"
  > & { openChecks?: number; questionCount?: number },
): UploadStage {
  if (s.approvedAt) return "completed";
  if (
    hasOpenUploadChecks(s) ||
    ["needs_input", "needs_attention", "paused"].includes(s.status)
  )
    return "attention";
  if (s.status === "failed") return "failed";
  if (["completed", "completed_with_errors", "confirmed"].includes(s.status)) {
    if (!(s.questions?.length || s.questionCount)) return "failed";
    return s.openChecks || s.questions?.some(needsQuestionCheck)
      ? "attention"
      : "review";
  }
  return ["pending", "uploading"].includes(s.status)
    ? "uploading"
    : "processing";
}
export const uploadStageLabel: Record<UploadStage, string> = {
  uploading: "Uploading",
  processing: "Processing",
  attention: "Needs attention",
  review: "Ready to review",
  completed: "Completed",
  failed: "Couldn’t process",
};
