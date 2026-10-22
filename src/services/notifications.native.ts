import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as records from "../storage/records";
import type { ReminderSettings } from "./reminders";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function cancelReminders(owner: string) {
  const ids =
    (await records.read<string[]>(owner, "notification-plan", "current")) || [];
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
  await records.remove(owner, "notification-plan", "current");
}
export async function scheduleReminders(
  owner: string,
  settings: ReminderSettings,
  preview?: { title: string; body: string; targetTime: string },
  studiedDays: string[] = [],
) {
  await cancelReminders(owner);
  if (!settings.enabled) return;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("study", {
      name: "Study reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Allow notifications in device settings to receive study reminders.",
    );
  const time =
    settings.mode === "smart"
      ? preview?.targetTime || settings.time
      : settings.time;
  const [h, m] = time.split(":").map(Number);
  const ids: string[] = [];
  const minute = h * 60 + m,
    quietStart = settings.quietStart
      .split(":")
      .reduce((a, n, i) => a + Number(n) * (i ? 1 : 60), 0),
    quietEnd = settings.quietEnd
      .split(":")
      .reduce((a, n, i) => a + Number(n) * (i ? 1 : 60), 0);
  const quiet =
    quietStart > quietEnd
      ? minute >= quietStart || minute < quietEnd
      : minute >= quietStart && minute < quietEnd;
  if (quiet) throw new Error("Choose a reminder time outside quiet hours.");
  for (let day = 0; day < 28; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    date.setHours(h, m, 0, 0);
    const key =
      date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    if (
      date.getTime() <= Date.now() ||
      !settings.days.includes(date.getDay()) ||
      studiedDays.includes(key) ||
      (settings.pausedUntil &&
        date.getTime() < Date.parse(settings.pausedUntil))
    )
      continue;
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: {
          title: settings.personalized
            ? preview?.title || "A study moment with Scholar"
            : "A study moment with Scholar",
          body: settings.personalized
            ? preview?.body || "Come back for a short practice session."
            : "Come back for a short practice session.",
          data: { screen: "Main", tab: "library", owner },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: "study",
        },
      }),
    );
  }
  await records.write(owner, "notification-plan", "current", ids);
}
export async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: "PastQ · Scholar", body: "A study moment with Scholar" },
    trigger: null,
  });
}
