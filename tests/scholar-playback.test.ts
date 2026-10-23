import test from "node:test";
import assert from "node:assert/strict";
import {
  createScholarPlayer,
  scholarBlend,
} from "../src/domain/scholarPlayback";
import { scholarMotion, type ScholarFrame } from "../src/domain/scholarMotion";
function harness(state: Parameters<typeof createScholarPlayer>[0]) {
  let time = 0,
    id = 0;
  const pending = new Map<number, { at: number; callback: () => void }>(),
    seen: ScholarFrame[] = [];
  const player = createScholarPlayer(state, (pose) => seen.push(pose), {
    now: () => time,
    schedule: (callback, delay) => {
      const key = ++id;
      pending.set(key, { at: time + delay, callback });
      return key;
    },
    cancel: (key) => {
      pending.delete(key as number);
    },
  });
  return {
    player,
    pending,
    seen,
    jump(to: number) {
      time = to;
    },
    fire() {
      const next = [...pending.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) return;
      pending.delete(next[0]);
      time = Math.max(time, next[1].at);
      next[1].callback();
    },
  };
}
test("study responds immediately and its fades finish before the next pose", () => {
  const h = harness("study");
  h.player.resume();
  h.fire();
  assert.equal(h.seen.at(-1)?.action, "study");
  assert.equal(h.seen.at(-1)?.row, 8);
  for (const state of [
    "idle",
    "study",
    "thinking",
    "waiting",
    "encourage",
    "celebrate",
  ] as const)
    for (let turn = 0; turn < 6; turn++)
      for (const pose of scholarMotion(state, turn))
        assert.ok(scholarBlend(pose) < pose.hold / 2);
  h.player.dispose();
  assert.equal(h.pending.size, 0);
});
test("late timer callbacks use the remaining absolute deadline without accumulating drift", () => {
  const h = harness("study");
  h.player.resume();
  h.jump(300);
  h.fire();
  assert.equal(h.seen.at(-1)?.frame, 0);
  assert.equal([...h.pending.values()][0].at, 460);
  h.fire();
  assert.equal(h.seen.at(-1)?.frame, 1);
  assert.equal([...h.pending.values()][0].at, 1460);
});
test("background or unfocused pause retains the remaining hold and does not catch up on resume", () => {
  const h = harness("study");
  h.player.resume();
  h.jump(100);
  h.player.pause();
  assert.equal(h.pending.size, 0);
  const count = h.seen.length;
  h.jump(100000);
  h.player.resume();
  assert.equal(h.seen.length, count);
  assert.equal([...h.pending.values()][0].at, 100120);
  h.fire();
  assert.equal(h.seen.at(-1)?.row, 8);
  h.player.dispose();
  h.player.resume();
  assert.equal(h.pending.size, 0);
});
test("celebration settles once into its smile and leaves no animation timer running", () => {
  const h = harness("celebrate");
  h.player.resume();
  for (let i = 0; i < 15; i++) h.fire();
  assert.equal(h.seen.at(-1)?.action, "smile");
  assert.equal(h.pending.size, 0);
  const count = h.seen.length;
  h.player.resume();
  assert.equal(h.seen.length, count);
});
