import type { PracticeSummary } from "../services/history";
import type { AttemptHeader } from "../storage/practice";
export type { PracticeSummary };
export interface HistoryItem {
  id: string;
  title: string;
  completedAt: number;
  percent: number | null;
  local: boolean;
  correct: number;
  total: number;
}
export function mergeHistory(
  local: AttemptHeader[],
  remote: PracticeSummary[],
): HistoryItem[] {
  const rows = new Map<string, HistoryItem>();
  for (const row of remote) {
    const total = row.graded_total ?? row.total_questions;
    rows.set(row.id, {
      id: row.id,
      title: row.title,
      completedAt: Date.parse(row.completed_at),
      percent: total > 0 ? Math.round((row.score / total) * 100) : null,
      correct: row.score,
      total,
      local: false,
    });
  }
  for (const row of local)
    if (row.status === "completed")
      rows.set(row.id, {
        id: row.id,
        title: row.title,
        completedAt: row.completedAt || row.startedAt,
        percent: row.summary.percent,
        correct: row.summary.correct,
        total: row.summary.graded,
        local: true,
      });
  return [...rows.values()].sort((a, b) => b.completedAt - a.completedAt);
}
