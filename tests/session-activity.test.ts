import test from "node:test";
import assert from "node:assert/strict";
import { sessionActivity } from "../src/domain/sessionActivity";
import { mergeHistory } from "../src/domain/history";
import type { AttemptHeader } from "../src/storage/practice";
const now = new Date(2026, 9, 24, 12);
test("session chart counts actual completed sessions once and keeps total separate from the seven-day chart", () => {
  const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).getTime();
  const a = sessionActivity(
    [
      { id: "old", completedAt: at(1) },
      { id: "one", completedAt: at(18) },
      { id: "two", completedAt: at(24) },
      { id: "two", completedAt: at(24) },
      { id: "invalid", completedAt: NaN },
      { id: "future", completedAt: at(25) },
    ],
    now,
  );
  assert.equal(a.total, 3);
  assert.equal(a.recent, 2);
  assert.deepEqual(
    a.days.map((d) => d.count),
    [1, 0, 0, 0, 0, 0, 1],
  );
  assert.equal(a.max, 1);
});
test("local midnight belongs to the correct day without treating calendar days as fixed durations", () => {
  const a = sessionActivity(
    [
      { id: "a", completedAt: new Date(2026, 9, 18, 0, 0).getTime() },
      { id: "b", completedAt: new Date(2026, 9, 17, 23, 59).getTime() },
    ],
    now,
  );
  assert.equal(a.total, 2);
  assert.equal(a.recent, 1);
  assert.equal(a.days[0].key, "2026-10-18");
  assert.equal(a.days[6].key, "2026-10-24");
});
test("empty charts contain seven true zeroes and do not draw invented activity", () => {
  const a = sessionActivity([], now);
  assert.equal(a.total, 0);
  assert.equal(a.recent, 0);
  assert.ok(a.days.every((d) => d.count === 0));
  assert.equal(a.max, 1);
});
test("activity honours history deduplication, deletions and unfinished-session exclusion", () => {
  const local = [
    {
      id: "same",
      status: "completed",
      completedAt: now.getTime(),
      summary: { percent: 50, correct: 1, graded: 2 },
    },
    { id: "active", status: "active" },
    {
      id: "deleted",
      status: "completed",
      completedAt: now.getTime(),
      summary: { percent: 50, correct: 1, graded: 2 },
    },
  ] as AttemptHeader[];
  const merged = mergeHistory(
    local,
    [
      {
        id: "same",
        title: "Synced test",
        score: 1,
        total_questions: 2,
        completed_at: now.toISOString(),
      },
    ],
    new Set(["deleted"]),
  );
  assert.equal(sessionActivity(merged, now).total, 1);
});
