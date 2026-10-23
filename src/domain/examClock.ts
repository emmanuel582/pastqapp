export function formatTime(seconds: number) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return (
    Math.floor(n / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (n % 60).toString().padStart(2, "0")
  );
}
/** Reads the absolute deadline on every tick, including after background suspension. */
export function examCountdown(
  deadline: number,
  onTick: (seconds: number) => void,
  onExpire: () => void,
  now = Date.now,
) {
  let expired = false;
  return () => {
    const remaining = Math.max(0, Math.ceil((deadline - now()) / 1000));
    onTick(remaining);
    if (!remaining && !expired) {
      expired = true;
      onExpire();
    }
    return remaining;
  };
}
