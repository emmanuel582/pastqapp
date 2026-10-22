import { answerIndex } from "./examSession";
import { attemptSummary } from "./attempt";
import type { Attempt, Question, Bundle } from "./types";
export function practiceKey(
  bundleId: string,
  q: Question,
  index: number,
): string {
  return typeof q.practiceKey === "string"
    ? q.practiceKey
    : [
        q.sourceBundleId || bundleId,
        q.sourceType || "question",
        q.year || "-",
        q.paper || "-",
        q.pageIndex ?? "-",
        q.questionNumber ?? q.id,
        index,
      ].join(":");
}
export function normalizeBundle(raw: Bundle): Bundle {
  let description: Partial<Bundle> = {};
  if (typeof raw.description === "string") {
    try {
      description = JSON.parse(raw.description);
    } catch {}
  }
  const questions =
    raw.questions ||
    (raw.data as { questions?: Question[] })?.questions ||
    description.questions ||
    [];
  return {
    ...description,
    ...raw,
    id: raw.id || String(raw.bundleId),
    title: raw.title || String(raw.name || "Saved material"),
    updatedAt: raw.updatedAt || String(raw.updated_at || "original"),
    questions: questions.map((q, i) => ({
      ...q,
      explanation: q.explanation || "",
      practiceKey: practiceKey(raw.id, q, i),
    })),
  };
}
export function historyRow(attempt: Attempt) {
  const stats = attemptSummary(attempt);
  return {
    id: attempt.id,
    user_id: attempt.owner,
    title: attempt.title,
    score: stats.correct,
    total_questions: attempt.questions.length,
    created_at: new Date(attempt.completedAt!).toISOString(),
    duration_seconds: Math.max(
      0,
      Math.min(
        attempt.duration,
        Math.round((attempt.completedAt! - attempt.startedAt) / 1000),
      ),
    ),
    source_bundle_id: attempt.bundleId,
    source_bundle_version: attempt.version || null,
    answered_count: stats.answered,
  };
}
export function analyticsInput(attempt: Attempt) {
  return {
    id: attempt.id,
    completedAt: new Date(attempt.completedAt!).toISOString(),
    userId: attempt.owner,
    sourceBundleId: attempt.bundleId,
    sourceBundleVersion: attempt.version || null,
    durationSeconds: Math.max(
      0,
      Math.min(
        attempt.duration,
        Math.round((attempt.completedAt! - attempt.startedAt) / 1000),
      ),
    ),
    score: attemptSummary(attempt).correct,
    attempts: attempt.questions.map((q, i) => ({
      questionKey: practiceKey(attempt.bundleId, q, i),
      topicKey: [
        q.sourceBundleId || attempt.bundleId,
        q.subject,
        q.topic || q.section || "general",
      ].join(":"),
      selectedOptionIndex:
        q.type === "theory" || q.type === "short_answer"
          ? null
          : attempt.answers[i],
      answered: attempt.answers[i] !== null || !!attempt.written[i]?.trim(),
      isCorrect:
        answerIndex(q) === null || attempt.answers[i] === null
          ? null
          : attempt.answers[i] === answerIndex(q),
      attemptOrder: i,
    })),
  };
}
export function trustedApiUrl(value: string, base: string): string | null {
  try {
    const api = new URL(base),
      url = new URL(value, api);
    return api.origin === url.origin && url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
