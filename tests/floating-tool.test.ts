import test from "node:test";
import assert from "node:assert/strict";
import {
  fitTool,
  initialTool,
  moveTool,
  resizeTool,
} from "../src/domain/floatingTool";
test("calculator stays reachable while dragged, resized and rotated", () => {
  for (const bounds of [
    { width: 374, height: 766 },
    { width: 812, height: 358 },
    { width: 304, height: 540 },
  ]) {
    const start = initialTool(bounds);
    for (const frame of [
      start,
      moveTool(start, 9999, -9999, bounds),
      resizeTool(start, 9999, 9999, bounds),
      resizeTool(start, -9999, -9999, bounds),
    ]) {
      assert.ok(frame.x >= 0 && frame.y >= 0);
      assert.ok(frame.x + frame.width <= bounds.width);
      assert.ok(frame.y + frame.height <= bounds.height);
      assert.ok(frame.width >= Math.min(248, bounds.width));
      assert.ok(frame.height >= Math.min(380, bounds.height));
    }
  }
  const rotated = fitTool(
    { x: 600, y: 200, width: 440, height: 500 },
    { width: 304, height: 540 },
  );
  assert.equal(rotated.x, 0);
  assert.equal(rotated.width, 304);
});
test("moving and resizing preserve the other dimensions until a screen boundary is reached", () => {
  const bounds = { width: 1000, height: 900 },
    frame = { x: 100, y: 100, width: 300, height: 400 };
  assert.deepEqual(moveTool(frame, 40, 20, bounds), {
    ...frame,
    x: 140,
    y: 120,
  });
  assert.deepEqual(resizeTool(frame, 40, 20, bounds), {
    ...frame,
    width: 340,
    height: 420,
  });
});
