/** Deliberate single-finger horizontal motion; leave taps and vertical reading alone. */
export function horizontalQuestionIntent(
  dx: number,
  dy: number,
  touches = 1,
): boolean {
  return (
    touches === 1 && Math.abs(dx) >= 18 && Math.abs(dx) > Math.abs(dy) * 1.8
  );
}
export function questionSwipeDirection(
  dx: number,
  dy: number,
  velocityX: number,
): -1 | 1 | null {
  if (!horizontalQuestionIntent(dx, dy)) return null;
  if (Math.abs(dx) < 70 && !(Math.abs(dx) >= 35 && Math.abs(velocityX) >= 0.45))
    return null;
  return dx < 0 ? 1 : -1;
}
export function adjacentQuestion(
  indexes: readonly number[],
  current: number,
  direction: -1 | 1,
): number | null {
  const position = indexes.indexOf(current);
  return position < 0 ? null : (indexes[position + direction] ?? null);
}
