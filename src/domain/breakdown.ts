import { answerIndex } from "./examSession";
import { topicOf } from "./cbtFilters";
import type { Attempt } from "./types";
export interface TopicResult {
  subject: string;
  topic: string;
  total: number;
  attempted: number;
  correct: number;
  missed: number;
  unanswered: number;
  ungraded: number;
}
/** Every presented question is counted once, including unkeyed and written questions. */
export function topicBreakdown(
  attempt: Pick<Attempt, "questions" | "answers" | "written">,
): TopicResult[] {
  const groups = new Map<string, TopicResult>();
  attempt.questions.forEach((q, i) => {
    const subject = q.subject?.trim() || "General",
      topic = topicOf(q) || "Unspecified topic",
      id = JSON.stringify([subject, topic]);
    const row = groups.get(id) || {
      subject,
      topic,
      total: 0,
      attempted: 0,
      correct: 0,
      missed: 0,
      unanswered: 0,
      ungraded: 0,
    };
    row.total++;
    const theory = q.type === "theory" || q.type === "short_answer",
      answered = theory
        ? !!attempt.written[i]?.trim()
        : attempt.answers[i] != null;
    if (!answered) row.unanswered++;
    else {
      row.attempted++;
      const key = answerIndex(q);
      if (key === null) row.ungraded++;
      else if (attempt.answers[i] === key) row.correct++;
      else row.missed++;
    }
    groups.set(id, row);
  });
  return [...groups.values()].sort(
    (a, b) =>
      a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic),
  );
}
