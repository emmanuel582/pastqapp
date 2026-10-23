import {
  scholarMotion,
  type ScholarFrame,
  type ScholarState,
} from "./scholarMotion";

export const openingScholarTurn = (state: ScholarState) =>
  state === "idle" ? 0 : 1;
export function scholarBlend(pose: ScholarFrame, remaining = pose.hold) {
  return Math.max(0, Math.min(pose.blend, 160, remaining * 0.45));
}
type Timing = {
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (handle: unknown) => void;
};
/** One timer per pose boundary. Absolute deadlines prevent drift; no JS render loop. */
export function createScholarPlayer(
  state: ScholarState,
  publish: (pose: ScholarFrame) => void,
  timing: Timing = {},
) {
  const now = timing.now || (() => performance.now());
  const schedule =
    timing.schedule || ((callback, delay) => setTimeout(callback, delay));
  const cancel =
    timing.cancel ||
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let turn = openingScholarTurn(state),
    index = 0,
    sequence = scholarMotion(state, turn);
  let remaining = sequence[0].hold,
    deadline = 0,
    timer: unknown;
  let active = false,
    disposed = false,
    finished = false,
    emitted = false;
  const clear = () => {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  };
  function emit() {
    const pose = sequence[index];
    publish({ ...pose, blend: scholarBlend(pose, remaining) });
    emitted = true;
  }
  function arm() {
    timer = schedule(tick, Math.max(1, deadline - now()));
  }
  function tick() {
    timer = undefined;
    if (!active || disposed || finished) return;
    const time = now();
    let steps = 0;
    while (time >= deadline) {
      index++;
      if (index >= sequence.length) {
        if (state === "celebrate") {
          finished = true;
          active = false;
          publish({ row: 8, frame: 5, hold: 0, blend: 0, action: "smile" });
          return;
        }
        sequence = scholarMotion(state, ++turn);
        index = 0;
      }
      deadline += sequence[index].hold;
      if (++steps >= 64) {
        deadline = time + sequence[index].hold;
        break;
      }
    }
    remaining = Math.max(1, deadline - time);
    emit();
    arm();
  }
  return {
    resume() {
      if (disposed || active || finished) return;
      active = true;
      deadline = now() + remaining;
      if (!emitted) emit();
      arm();
    },
    pause() {
      if (!active || disposed) return;
      remaining = Math.max(1, deadline - now());
      active = false;
      clear();
    },
    dispose() {
      disposed = true;
      active = false;
      clear();
    },
  };
}
