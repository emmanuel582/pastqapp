/** Round up the remaining minute so a live exam never displays zero before expiry. */
export function formatRemainingTime(seconds: number, spoken = false) {
  const minutes = Math.ceil(
    Math.max(0, Number.isFinite(seconds) ? seconds : 0) / 60,
  );
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return spoken
    ? `${hours} ${hours === 1 ? "hour" : "hours"} ${rest} ${rest === 1 ? "minute" : "minutes"}`
    : `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

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
