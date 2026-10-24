import { isWrittenQuestion, theoryLabel } from "./theory";
import { questionAnswered, questionOutcome } from "./attempt";
import type { Attempt } from "./types";
export type AnswerFilter =
  "all" | "correct" | "incorrect" | "skipped" | "reviewed";
export type ReviewFilter = AnswerFilter | "saved";
export function reviewQuestions(
  attempt: Pick<Attempt, "questions" | "answers" | "written">,
  filter: AnswerFilter = "all",
) {
  return attempt.questions.flatMap((_, i) =>
    filter === "all" || questionOutcome(attempt, i) === filter ? [i] : [],
  );
}
export const outcomeLabel = {
  correct: "Correct",
  incorrect: "Wrong",
  skipped: "Unanswered",
  reviewed: "Not auto-marked",
} as const;
export function questionNumberLabel(
  attempt: Pick<Attempt, "questions" | "answers" | "written">,
  index: number,
  review: boolean,
) {
  return (
    "Question " +
    (isWrittenQuestion(attempt.questions[index])
      ? theoryLabel(attempt.questions[index], index)
      : index + 1) +
    ", " +
    attempt.questions[index].subject +
    ", " +
    (review
      ? outcomeLabel[questionOutcome(attempt, index)]
      : questionAnswered(attempt, index)
        ? "Answered"
        : "Unanswered")
  );
}
