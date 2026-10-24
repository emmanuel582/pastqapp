import test from "node:test";
import assert from "node:assert/strict";
import {
  fitWorkingBoard,
  resizeWorkingBoard,
} from "../src/domain/workingBoard";
test("working paper resizes continuously through the available phone space and reverses immediately at boundaries", () => {
  const bounds = { width: 644, height: 600 };
  let size = { width: 320, height: 260 };
  for (let step = 0; step < 10; step++)
    size = resizeWorkingBoard(size, -20, false, bounds);
  assert.equal(size.height, 460);
  size = resizeWorkingBoard(size, -1000, false, bounds);
  assert.equal(size.height, 600);
  size = resizeWorkingBoard(size, 12, false, bounds);
  assert.equal(size.height, 588);
  size = resizeWorkingBoard(size, 1000, false, bounds);
  assert.equal(size.height, 156);
  size = resizeWorkingBoard(size, -10, false, bounds);
  assert.equal(size.height, 166);
});
test("landscape paper can grow and shrink without taking the question offscreen", () => {
  const bounds = { width: 644, height: 358 };
  let size = resizeWorkingBoard(
    { width: 320, height: 260 },
    -150,
    true,
    bounds,
  );
  assert.equal(size.width, 470);
  size = resizeWorkingBoard(size, -9999, true, bounds);
  assert.equal(size.width, 644);
  size = resizeWorkingBoard(size, 10, true, bounds);
  assert.equal(size.width, 634);
  size = resizeWorkingBoard(size, 9999, true, bounds);
  assert.equal(size.width, 220);
  assert.deepEqual(
    fitWorkingBoard({ width: 640, height: 600 }, { width: 180, height: 120 }),
    { width: 180, height: 120 },
  );
});

import {
  canvasWorkingPoint,
  workingViewportHeight,
  workingPan,
  projectWorkingPaper,
  validateWorkingPaper,
  emptyWorkingPaper,
} from "../src/domain/working";
test("resizing reveals more paper without stretching existing handwriting", () => {
  assert.deepEqual(canvasWorkingPoint(60, 90, 300), { x: 160, y: 240 });
  assert.equal(workingViewportHeight(300, 150), 400);
  assert.equal(workingViewportHeight(300, 450), 1200);
  // The same point on a rotated, wider display scales equally along both axes.
  assert.deepEqual(canvasWorkingPoint(120, 180, 600), { x: 160, y: 240 });
  assert.deepEqual(canvasWorkingPoint(60, 90, 300, 800), { x: 160, y: 1040 });
});
test("older saved ink projects into the proportional paper without changing the original record", () => {
  const old = {
    version: 1 as const,
    strokes: [{ erase: false, size: 3, points: [{ x: 400, y: 350 }] }],
  };
  const projected = projectWorkingPaper(old, 300, 150);
  assert.deepEqual(projected.strokes[0].points[0], { x: 400, y: 350 });
  assert.equal(
    projected.strokes[0].points[0].y * projected.strokes[0].legacyScaleY!,
    200,
  );
  assert.equal(
    projected.strokes[0].size,
    old.strokes[0].size,
    "original pen and eraser widths are retained",
  );
  assert.equal(old.strokes[0].points[0].y, 350);
  assert.equal(validateWorkingPaper(projected), projected);
  assert.equal(projectWorkingPaper(projected, 300, 450), projected);
});
test("longer solutions can move through paper and reload a validated viewport", () => {
  assert.equal(workingPan(0, 100, 300, 450), 0);
  const viewY = workingPan(0, -300, 300, 450);
  assert.equal(viewY, 800);
  const p = {
    ...emptyWorkingPaper(),
    height: 2000,
    viewY,
    strokes: [
      {
        erase: false,
        size: 3,
        points: [canvasWorkingPoint(60, 90, 300, viewY)],
      },
    ],
  };
  assert.deepEqual(validateWorkingPaper(JSON.parse(JSON.stringify(p))), p);
  assert.equal(workingPan(7999, -900, 300, 450), 6800);
  assert.throws(() => validateWorkingPaper({ ...p, height: 8001 }));
  assert.throws(() => validateWorkingPaper({ ...p, viewY: -1 }));
});
