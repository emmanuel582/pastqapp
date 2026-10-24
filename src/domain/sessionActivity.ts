import type { HistoryItem } from "./history";
export interface SessionDay {
  key: string;
  label: string;
  dateLabel: string;
  count: number;
}
function dayKey(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}
/** Local calendar days, not seven 24-hour slices: midnight and DST stay correct. */
export function sessionActivity(
  items: Pick<HistoryItem, "id" | "completedAt">[],
  now = new Date(),
) {
  const days: SessionDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6 + i,
    );
    return {
      key: dayKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      dateLabel: date.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      count: 0,
    };
  });
  const byDay = new Map(days.map((day) => [day.key, day])),
    seen = new Set<string>();
  let total = 0;
  for (const item of items) {
    if (
      seen.has(item.id) ||
      !Number.isFinite(item.completedAt) ||
      item.completedAt > now.getTime()
    )
      continue;
    seen.add(item.id);
    total++;
    const day = byDay.get(dayKey(new Date(item.completedAt)));
    if (day) day.count++;
  }
  return {
    days,
    total,
    recent: days.reduce((n, d) => n + d.count, 0),
    max: Math.max(1, ...days.map((d) => d.count)),
  };
}
