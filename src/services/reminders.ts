import { request, json } from "./api";
export type ReminderSettings = {
  enabled: boolean;
  mode: "smart" | "scheduled";
  time: string;
  timezone: string;
  days: number[];
  quietStart: string;
  quietEnd: string;
  personalized: boolean;
  pausedUntil: string | null;
};
export type ReminderSnapshot = {
  settings: ReminderSettings;
  preview: {
    title: string;
    body: string;
    targetTime: string;
    studiedToday?: boolean;
  };
  push?: { configured: boolean };
};
export const reminderDefaults: ReminderSettings = {
  enabled: false,
  mode: "smart",
  time: "18:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
  days: [1, 2, 3, 4, 5, 6, 0],
  quietStart: "22:00",
  quietEnd: "07:00",
  personalized: true,
  pausedUntil: null,
};
export const getReminders = (signal?: AbortSignal) =>
  request<ReminderSnapshot>("/api/reminders", { signal }, true);
export const saveReminders = (settings: ReminderSettings) =>
  request<ReminderSnapshot>("/api/reminders", json("PUT", settings), true);
