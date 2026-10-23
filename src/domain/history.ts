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
  deleted: ReadonlySet<string> = new Set(),
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
  return [...rows.values()]
    .filter((row) => !deleted.has(row.id))
    .sort((a, b) => b.completedAt - a.completedAt);
}

export function historyDays(items: HistoryItem[], now = new Date()) {
  const key = (date: Date) =>
    date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const today = key(now),
    yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = key(yesterdayDate),
    groups = new Map<
      string,
      { key: string; title: string; data: HistoryItem[] }
    >();
  for (const item of [...items].sort((a, b) => b.completedAt - a.completedAt)) {
    const date = new Date(item.completedAt);
    if (!Number.isFinite(date.getTime())) continue;
    const day = key(date);
    if (!groups.has(day))
      groups.set(day, {
        key: day,
        title:
          day === today
            ? "Today"
            : day === yesterday
              ? "Yesterday"
              : date.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year:
                    date.getFullYear() === now.getFullYear()
                      ? undefined
                      : "numeric",
                }),
        data: [],
      });
    groups.get(day)!.data.push(item);
  }
  return [...groups.values()];
}
