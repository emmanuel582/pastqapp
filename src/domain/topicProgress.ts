import { answerIndex } from "./examSession";
import { topicOf } from "./cbtFilters";
import { questionIdentity } from "./attempt";
import type { Attempt, Asset, Question, Bundle } from "./types";
export interface TopicCounts {
  correct: number;
  wrong: number;
  skipped: number;
  ungraded: number;
  total: number;
}
export interface TopicSample extends TopicCounts {
  id: string;
  subject: string;
  topic: string;
}
export interface ProgressSession {
  id: string;
  completedAt: number;
  topics: TopicSample[];
}
export interface TopicProgress extends TopicSample {
  graded: number;
  percent: number | null;
  sessions: number;
  sourceIds: string[];
  points: {
    id: string;
    at: number;
    correct: number;
    graded: number;
    wrong: number;
    skipped: number;
    percent: number;
  }[];
}
export const topicId = (subject: string, topic: string) =>
  JSON.stringify([
    subject.trim().toLocaleLowerCase(),
    topic.trim().toLocaleLowerCase(),
  ]);
export function progressSession(a: Attempt): ProgressSession | null {
  if (
    a.status !== "completed" ||
    !Number.isFinite(a.completedAt) ||
    !a.completedAt
  )
    return null;
  const groups = new Map<string, TopicSample>();
  a.questions.forEach((q, i) => {
    const subject = q.subject?.trim() || "General",
      topic = topicOf(q) || "Unlabelled topic",
      id = topicId(subject, topic);
    const row = groups.get(id) || {
      id,
      subject,
      topic,
      correct: 0,
      wrong: 0,
      skipped: 0,
      ungraded: 0,
      total: 0,
    };
    row.total++;
    const key = answerIndex(q);
    if (key === null) row.ungraded++;
    else if (a.answers[i] == null) row.skipped++;
    else if (a.answers[i] === key) row.correct++;
    else row.wrong++;
    groups.set(id, row);
  });
  return {
    id: a.id,
    completedAt: a.completedAt!,
    topics: [...groups.values()],
  };
}
export function topicProgress(
  sessions: ProgressSession[],
  since = 0,
): TopicProgress[] {
  const rows = new Map<string, TopicProgress>(),
    seen = new Set<string>();
  for (const s of [...sessions].sort((a, b) => a.completedAt - b.completedAt)) {
    if (seen.has(s.id) || s.completedAt < since) continue;
    seen.add(s.id);
    for (const t of s.topics) {
      const r = rows.get(t.id) || {
        ...t,
        correct: 0,
        wrong: 0,
        skipped: 0,
        ungraded: 0,
        total: 0,
        graded: 0,
        percent: null,
        sessions: 0,
        sourceIds: [],
        points: [],
      };
      for (const key of [
        "correct",
        "wrong",
        "skipped",
        "ungraded",
        "total",
      ] as const)
        r[key] += t[key];
      r.sessions++;
      r.sourceIds.push(s.id);
      const graded = t.correct + t.wrong + t.skipped;
      if (graded)
        r.points.push({
          id: s.id,
          at: s.completedAt,
          correct: t.correct,
          wrong: t.wrong,
          skipped: t.skipped,
          graded,
          percent: Math.round((t.correct * 100) / graded),
        });
      r.graded = r.correct + r.wrong + r.skipped;
      r.percent = r.graded ? Math.round((r.correct * 100) / r.graded) : null;
      rows.set(t.id, r);
    }
  }
  const priority = (r: TopicProgress) =>
    !r.graded
      ? 4
      : r.graded < 5
        ? 2
        : r.percent! < 50
          ? 0
          : r.percent! < 75
            ? 1
            : 3;
  return [...rows.values()].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.percent ?? 101) - (b.percent ?? 101) ||
      b.graded - a.graded ||
      a.topic.localeCompare(b.topic),
  );
}
export function topicAdvice(row: TopicProgress): string {
  if (!row.graded) return "Not auto-marked";
  if (row.graded < 5) return "Try a few more questions";
  if (row.percent! < 50) return "Needs practice";
  if (row.percent! < 75) return "Keep practising";
  return "Doing well";
}
/** Reuse saved full questions offline; choose missed questions first, once per identity. */
export function topicPracticePaper(
  attempts: Attempt[],
  id: string,
  limit = 10,
): Bundle | null {
  const choices = new Map<
    string,
    { q: Question; assets: Record<string, Asset>; missed: boolean }
  >();
  for (const a of [...attempts].sort(
    (a, b) => (b.completedAt || 0) - (a.completedAt || 0),
  )) {
    if (a.status !== "completed") continue;
    a.questions.forEach((q, i) => {
      if (
        topicId(
          q.subject?.trim() || "General",
          topicOf(q) || "Unlabelled topic",
        ) !== id ||
        answerIndex(q) === null
      )
        return;
      const key = questionIdentity(q);
      if (choices.has(key)) return;
      choices.set(key, {
        q,
        assets: a.assets || {},
        missed: a.answers[i] !== answerIndex(q),
      });
    });
  }
  const selected = [...choices.values()]
    .sort((a, b) => Number(b.missed) - Number(a.missed))
    .slice(0, limit);
  if (!selected.length) return null;
  const assets: Record<string, Asset> = {};
  for (const item of selected)
    for (const ref of JSON.stringify(item.q).match(/[a-f0-9]{64}/g) || [])
      if (item.assets[ref]) assets[ref] = item.assets[ref];
  return {
    id: "topic-practice:" + id,
    title: topicOf(selected[0].q) || "Topic practice",
    questions: selected.map((v) => v.q),
    assets,
  };
}
