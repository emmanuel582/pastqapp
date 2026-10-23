export interface ProgressDatum {
  id: string;
  title: string;
  percent: number | null;
  completedAt: number;
  correct?: number;
  total?: number;
}
/** Five equally spaced tests, in date order; each bar is a real scored session. */
export function progressPlot(items: ProgressDatum[], width: number) {
  const valid = items
    .filter(
      (v) =>
        Number.isFinite(v.percent) &&
        v.percent !== null &&
        v.percent >= 0 &&
        v.percent <= 100 &&
        Number.isFinite(v.completedAt),
    )
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-5);
  const height = Math.max(194, Math.min(224, width * 0.62)),
    left = 32,
    right = Math.max(left, width - 4),
    top = 28,
    bottom = height - 28;
  const slot = valid.length ? (right - left) / valid.length : 0;
  const points = valid.map((item, index) => ({
    ...item,
    percent: item.percent!,
    x: left + slot * (index + 0.5),
    y: bottom - ((bottom - top) * item.percent!) / 100,
  }));
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    slot,
    barWidth: Math.min(34, slot * 0.56),
    points,
  };
}
export function nearestProgressPoint(points: { x: number }[], x: number) {
  let best = 0;
  for (let i = 1; i < points.length; i++)
    if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
  return best;
}
