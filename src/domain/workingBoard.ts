export type WorkingBoardSize = { width: number; height: number };
const bounded = (value: number, minimum: number, maximum: number) =>
  Math.min(
    maximum,
    Math.max(
      Math.min(minimum, maximum),
      Number.isFinite(value) ? value : minimum,
    ),
  );
export function fitWorkingBoard(
  size: WorkingBoardSize,
  bounds: WorkingBoardSize,
): WorkingBoardSize {
  const width = Math.max(1, bounds.width),
    height = Math.max(1, bounds.height);
  return {
    width: bounded(size.width, 220, width),
    height: bounded(size.height, 156, height),
  };
}
/** Use incremental gesture travel so reversing at a screen edge responds immediately. */
export function resizeWorkingBoard(
  size: WorkingBoardSize,
  delta: number,
  side: boolean,
  bounds: WorkingBoardSize,
) {
  return fitWorkingBoard(
    {
      ...size,
      ...(side
        ? { width: size.width - delta }
        : { height: size.height - delta }),
    },
    bounds,
  );
}
