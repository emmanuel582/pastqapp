export type ToolBounds = { width: number; height: number };
export type ToolFrame = { x: number; y: number; width: number; height: number };
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
/** Keep every handle reachable after moving, resizing or rotating the phone. */
export function fitTool(frame: ToolFrame, bounds: ToolBounds): ToolFrame {
  const maxWidth = Math.max(1, Math.min(440, bounds.width));
  const maxHeight = Math.max(1, Math.min(560, bounds.height));
  const width = clamp(frame.width, Math.min(248, maxWidth), maxWidth);
  const height = clamp(frame.height, Math.min(380, maxHeight), maxHeight);
  return {
    width,
    height,
    x: clamp(frame.x, 0, bounds.width - width),
    y: clamp(frame.y, 0, bounds.height - height),
  };
}
export function initialTool(bounds: ToolBounds): ToolFrame {
  return fitTool(
    { x: bounds.width - 308, y: bounds.height - 400, width: 308, height: 400 },
    bounds,
  );
}
export function moveTool(
  frame: ToolFrame,
  dx: number,
  dy: number,
  bounds: ToolBounds,
): ToolFrame {
  return fitTool({ ...frame, x: frame.x + dx, y: frame.y + dy }, bounds);
}
export function resizeTool(
  frame: ToolFrame,
  dx: number,
  dy: number,
  bounds: ToolBounds,
): ToolFrame {
  const next = fitTool(
    { ...frame, width: frame.width + dx, height: frame.height + dy },
    bounds,
  );
  // Resize towards the handle without unexpectedly shifting the opposite corner.
  return fitTool(
    {
      ...next,
      x: frame.x,
      y: frame.y,
      width: Math.min(next.width, bounds.width - frame.x),
      height: Math.min(next.height, bounds.height - frame.y),
    },
    bounds,
  );
}
