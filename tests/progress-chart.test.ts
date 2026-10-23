import test from "node:test";
import assert from "node:assert/strict";
import {
  progressPlot,
  nearestProgressPoint,
} from "../src/domain/progressChart";
test("score chart resizes without clipping labels/points, keeps zero scores and supports one session", () => {
  const items = [0, 40, 100].map((percent, i) => ({
    id: String(i),
    title: "Exam",
    percent,
    completedAt: 1000 + i,
  }));
  for (const width of [180, 250, 390, 700]) {
    const p = progressPlot(items, width);
    assert.equal(p.points.length, 3);
    for (const point of p.points) {
      assert.ok(point.x >= p.left && point.x <= p.right);
      assert.ok(point.y >= p.top && point.y <= p.bottom);
    }
    assert.equal(nearestProgressPoint(p.points, p.right), 2);
    assert.equal(nearestProgressPoint(p.points, p.left), 0);
  }
  assert.equal(progressPlot([items[0]], 300).points[0].x, (32 + 296) / 2);
});
test("score chart excludes ungraded/invalid records and limits the view to real recent sessions", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    title: "Exam",
    percent: i,
    completedAt: i,
  }));
  const p = progressPlot(
    [
      ...items,
      { id: "bad", title: "Bad", percent: NaN, completedAt: 1 },
      { id: "theory", title: "Theory", percent: null, completedAt: 2 },
    ],
    300,
  );
  assert.equal(p.points.length, 5);
  assert.equal(p.points[0].id, "7");
});

test("test bars are chronological, labelled and fit inside each responsive slot", () => {
  const data = [100, 0, 55, 20, 75]
    .map((percent, i) => ({
      id: String(i),
      title: "Test",
      percent,
      completedAt: i,
    }))
    .reverse();
  for (const width of [180, 250, 390, 700]) {
    const p = progressPlot(data, width);
    assert.equal(p.points[0].id, "0");
    for (const point of p.points) {
      assert.ok(point.x - p.barWidth / 2 >= p.left);
      assert.ok(point.x + p.barWidth / 2 <= p.right);
    }
    assert.equal(p.points[1].percent, 0);
    assert.equal(p.points[0].percent, 100);
  }
});
