import type { ReminderSettings } from "./reminders";
export async function cancelReminders(_owner: string) {}
export async function scheduleReminders(
  _owner: string,
  settings: ReminderSettings,
  _preview?: { title: string; body: string; targetTime: string },
  _days?: string[],
) {
  if (settings.enabled)
    throw new Error("Open the iOS or Android app to enable device reminders.");
}
export async function testNotification() {
  throw new Error("Open the iOS or Android app to test device reminders.");
}
