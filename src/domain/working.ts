export interface WorkingPoint {
  x: number;
  y: number;
}
export interface WorkingStroke {
  points: WorkingPoint[];
  erase: boolean;
  size: number;
}
export interface WorkingPaper {
  version: 1;
  strokes: WorkingStroke[];
}
export const emptyWorkingPaper = (): WorkingPaper => ({
  version: 1,
  strokes: [],
});
export function workingPoint(
  x: number,
  y: number,
  width: number,
  height: number,
): WorkingPoint {
  return {
    x: Math.max(0, Math.min(800, (x / Math.max(1, width)) * 800)),
    y: Math.max(0, Math.min(700, (y / Math.max(1, height)) * 700)),
  };
}
/** Keep long gestures bounded while retaining their entire shape, including the end. */
export function appendWorkingPoint(
  stroke: WorkingStroke,
  point: WorkingPoint,
  final = false,
) {
  const last = stroke.points[stroke.points.length - 1];
  if (!final && last && Math.hypot(point.x - last.x, point.y - last.y) < 1.5)
    return;
  if (stroke.points.length >= 4096)
    stroke.points = stroke.points.filter((_, i) => i % 2 === 0);
  stroke.points.push(point);
}
export function validateWorkingPaper(raw: unknown): WorkingPaper {
  const value = raw as WorkingPaper;
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.strokes) ||
    value.strokes.length > 1000 ||
    value.strokes.some(
      (s) =>
        !s ||
        typeof s.erase !== "boolean" ||
        !Number.isFinite(s.size) ||
        s.size < 1 ||
        s.size > 50 ||
        !Array.isArray(s.points) ||
        !s.points.length ||
        s.points.length > 4096 ||
        s.points.some(
          (p) =>
            !p ||
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            p.x < 0 ||
            p.x > 800 ||
            p.y < 0 ||
            p.y > 700,
        ),
    )
  )
    throw Error("This saved working paper is invalid.");
  return value;
}
