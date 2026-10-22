import type { ReminderSettings } from "./reminders";
export type ReminderPreview = {
  title: string;
  body: string;
  targetTime: string;
};
export type PlannedReminder = { date: Date; title: string; body: string };
export type NotificationOpen = { id: string; data: Record<string, unknown> };
export type NotificationDestination =
  | { screen: "Main"; tab: "library" }
  | { screen: "Notifications" }
  | { screen: "ReviewMaterial"; sessionId: string };
export function localStudyDay(date: Date): string {
  return (
    date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
  );
}
function minuteOfDay(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw Error("Enter a valid reminder time, for example 18:00.");
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function buildReminderPlan(
  settings: ReminderSettings,
  preview?: ReminderPreview,
  studiedDays: string[] = [],
  now = new Date(),
): PlannedReminder[] {
  if (!settings.enabled) return [];
  const days = new Set(
    settings.days.filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6,
    ),
  );
  if (!days.size) throw Error("Choose at least one day for your reminders.");
  const time =
    settings.mode === "smart"
      ? preview?.targetTime || settings.time
      : settings.time;
  const minute = minuteOfDay(time),
    start = minuteOfDay(settings.quietStart),
    end = minuteOfDay(settings.quietEnd);
  const quiet =
    start === end
      ? false
      : start > end
        ? minute >= start || minute < end
        : minute >= start && minute < end;
  if (quiet) throw Error("Choose a reminder time outside quiet hours.");
  const paused = settings.pausedUntil ? Date.parse(settings.pausedUntil) : 0;
  if (!Number.isFinite(paused)) throw Error("Choose a valid pause date.");
  const studied = new Set(studiedDays),
    result: PlannedReminder[] = [];
  for (let offset = 0; offset < 28; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    if (
      date <= now ||
      !days.has(date.getDay()) ||
      studied.has(localStudyDay(date)) ||
      date.getTime() < paused
    )
      continue;
    result.push({
      date,
      title: settings.personalized
        ? preview?.title || "A study moment with Scholar"
        : "A study moment with Scholar",
      body: settings.personalized
        ? preview?.body || "Come back for a short practice session."
        : "Come back for a short practice session.",
    });
  }
  return result;
}
export function notificationDestination(
  data: Record<string, unknown>,
  owner: string,
): NotificationDestination | null {
  if (!owner || owner === "guest" || data.owner !== owner) return null;
  if (
    data.kind === "study-reminder" ||
    (data.screen === "Main" && data.tab === "library")
  )
    return { screen: "Main", tab: "library" };
  if (data.kind === "inbox") return { screen: "Notifications" };
  if (
    data.kind === "material-ready" &&
    typeof data.sessionId === "string" &&
    /^[a-zA-Z0-9_-]{1,120}$/.test(data.sessionId)
  )
    return { screen: "ReviewMaterial", sessionId: data.sessionId };
  return null;
}
