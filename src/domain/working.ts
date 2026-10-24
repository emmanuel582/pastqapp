export interface WorkingPoint {
  x: number;
  y: number;
}
export interface WorkingStroke {
  points: WorkingPoint[];
  erase: boolean;
  size: number;
  legacyScaleY?: number;
}
export type WorkingPaper =
  | { version: 1; strokes: WorkingStroke[] }
  | { version: 2; strokes: WorkingStroke[]; height: number; viewY: number };
export type ScrollableWorkingPaper = Extract<WorkingPaper, { version: 2 }>;
export const MAX_WORKING_HEIGHT = 8000;
export const emptyWorkingPaper = (): ScrollableWorkingPaper => ({
  version: 2,
  strokes: [],
  height: 700,
  viewY: 0,
});
export function workingViewportHeight(width: number, height: number) {
  return Math.min(
    MAX_WORKING_HEIGHT,
    Math.max(1, (height * 800) / Math.max(1, width)),
  );
}
/** A single scale for both axes keeps handwriting proportional when the viewport changes. */
export function canvasWorkingPoint(
  x: number,
  y: number,
  width: number,
  viewY = 0,
): WorkingPoint {
  const scale = 800 / Math.max(1, width);
  return {
    x: Math.max(0, Math.min(800, x * scale)),
    y: Math.max(0, Math.min(MAX_WORKING_HEIGHT, viewY + y * scale)),
  };
}
export function workingPan(
  viewY: number,
  delta: number,
  width: number,
  height: number,
) {
  return Math.max(
    0,
    Math.min(
      MAX_WORKING_HEIGHT - workingViewportHeight(width, height),
      viewY - (delta * 800) / Math.max(1, width),
    ),
  );
}
/** Preserve legacy ink's current appearance without modifying its stored source record. */
export function projectWorkingPaper(
  paper: WorkingPaper,
  width: number,
  height: number,
): ScrollableWorkingPaper {
  if (paper.version === 2) return paper;
  const scaleY = workingViewportHeight(width, height) / 700;
  return {
    version: 2,
    height: Math.max(700, workingViewportHeight(width, height)),
    viewY: 0,
    strokes: paper.strokes.map((stroke) => ({
      ...stroke,
      legacyScaleY: scaleY,
    })),
  };
}
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
    ![1, 2].includes(value.version) ||
    (value.version === 2 &&
      (!Number.isFinite(value.height) ||
        value.height < 1 ||
        value.height > MAX_WORKING_HEIGHT ||
        !Number.isFinite(value.viewY) ||
        value.viewY < 0 ||
        value.viewY > value.height)) ||
    !Array.isArray(value.strokes) ||
    value.strokes.length > 1000 ||
    value.strokes.some(
      (s) =>
        !s ||
        typeof s.erase !== "boolean" ||
        (s.legacyScaleY !== undefined &&
          (value.version !== 2 ||
            !Number.isFinite(s.legacyScaleY) ||
            s.legacyScaleY <= 0 ||
            s.legacyScaleY > MAX_WORKING_HEIGHT / 700)) ||
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
            p.y * (s.legacyScaleY ?? 1) >
              (value.version === 2 ? value.height : 700),
        ),
    )
  )
    throw Error("This saved working paper is invalid.");
  return value;
}
