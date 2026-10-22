/** Separate editable clock fields; blank fields count as zero while typing. */
export function sessionDurationSeconds(
  hours: string,
  minutes: string,
): number | null {
  if (!/^\d*$/.test(hours) || !/^\d*$/.test(minutes)) return null;
  const h = Number(hours),
    m = Number(minutes),
    seconds = h * 3600 + m * 60;
  return Number.isSafeInteger(h) &&
    Number.isSafeInteger(m) &&
    m < 60 &&
    Number.isSafeInteger(seconds) &&
    seconds > 0
    ? seconds
    : null;
}

/** Keep earlier minute-only drafts, rounding fractional minutes up to a whole minute. */
export function durationFields(value: unknown): {
  hours: string;
  minutes: string;
} {
  const total =
    typeof value === "string" && value.trim() ? Math.ceil(Number(value)) : NaN;
  const minutes = Number.isSafeInteger(total) && total > 0 ? total : 20;
  return {
    hours: String(Math.floor(minutes / 60)),
    minutes: String(minutes % 60),
  };
}

export function durationLabel(seconds: number | null): string {
  if (seconds === null) return "Set time";
  const hours = Math.floor(seconds / 3600),
    minutes = (seconds % 3600) / 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes} min`;
}
