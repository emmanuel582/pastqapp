import { sessionSummary, answerIndex as importAnswerKey } from "./examSession";
import type { Attempt, Bundle, Question } from "./types";
export const remainingSeconds = (
  attempt: Pick<Attempt, "deadline" | "status" | "completedAt">,
  now = Date.now(),
) =>
  Math.max(
    0,
    Math.ceil((attempt.deadline - (attempt.completedAt ?? now)) / 1000),
  );
export function createAttempt(
  bundle: Bundle,
  questions: Question[],
  duration: number,
  mode: Attempt["mode"],
  owner: string,
  id: string,
  now = Date.now(),
): Attempt {
  if (!questions.length || !Number.isSafeInteger(duration) || duration <= 0)
    throw new Error("Choose questions and a valid duration.");
  return {
    id,
    owner,
    bundleId: bundle.id,
    title: bundle.title,
    questions,
    assets: bundle.assets,
    answers: questions.map(() => null),
    written: questions.map(() => ""),
    flagged: questions.map(() => false),
    current: 0,
    duration,
    startedAt: now,
    deadline: now + duration * 1000,
    mode,
    status: "active",
    version: bundle.updatedAt,
  };
}
export function patchAnswer(
  attempt: Attempt,
  index: number,
  option: number,
): Attempt {
  if (
    attempt.status !== "active" ||
    !attempt.questions[index] ||
    !Number.isInteger(option) ||
    option < 0 ||
    option >= attempt.questions[index].options.length
  )
    return attempt;
  const answers = [...attempt.answers];
  answers[index] = option;
  return { ...attempt, answers };
}
export function completeAttempt(attempt: Attempt, now = Date.now()): Attempt {
  return attempt.status === "completed"
    ? attempt
    : {
        ...attempt,
        status: "completed",
        completedAt: Math.min(now, attempt.deadline),
      };
}
export function attemptSummary(attempt: Attempt) {
  const summary = sessionSummary(attempt.questions, attempt.answers);
  const theoryAnswered = attempt.questions.filter(
    (q, i) =>
      (q.type === "theory" || q.type === "short_answer") &&
      attempt.answers[i] === null &&
      attempt.written[i]?.trim(),
  ).length;
  return {
    ...summary,
    answered: summary.answered + theoryAnswered,
    ungraded: summary.ungraded + theoryAnswered,
    skipped: summary.skipped - theoryAnswered,
  };
}
export function questionIdentity(
  q: import("./cbtFilters").CbtQuestion,
): string {
  if (typeof q.practiceKey === "string") return q.practiceKey;
  return JSON.stringify([
    q.sourceBundleId || "",
    q.id ?? null,
    q.subject,
    q.year || "",
    q.paper || "",
    q.questionNumber ?? null,
    q.question,
    q.options,
  ]);
}
export const bookmarkIdentity = (bundleId: string, q: Question) =>
  JSON.stringify([bundleId, questionIdentity(q)]);

export function questionAnswered(
  attempt: Pick<Attempt, "answers" | "written">,
  index: number,
) {
  return attempt.answers[index] != null || !!attempt.written[index]?.trim();
}
export function questionOutcome(
  attempt: Pick<Attempt, "questions" | "answers" | "written">,
  index: number,
) {
  if (!questionAnswered(attempt, index)) return "skipped";
  const key = importAnswerKey(attempt.questions[index]);
  return key === null
    ? "reviewed"
    : attempt.answers[index] === key
      ? "correct"
      : "incorrect";
}
