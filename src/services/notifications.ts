import type { ReminderSettings } from "./reminders";
export async function cancelReminders(_owner: string) {}
export async function scheduleReminders(
  _owner: string,
  settings: ReminderSettings,
  _preview?: { title: string; body: string; targetTime: string },
  _days?: string[],
  _requestPermission = true,
) {
  if (settings.enabled)
    throw new Error("Open the iOS or Android app to enable device reminders.");
}
export async function testNotification(_owner: string) {
  throw new Error("Open the iOS or Android app to test device reminders.");
}

export function configureNotificationContext(
  _owner: string,
  _activeExam: boolean,
) {}
export async function refreshReminders(_owner: string, _days: string[]) {}
export function observeNotificationResponses(
  _listener: (
    event: import("../domain/notifications").NotificationOpen,
  ) => void,
): () => void {
  return () => {};
}
export async function clearNotificationResponse() {}
