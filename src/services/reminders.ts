import { request, json } from "./api";
import type { ReminderSnapshot, ReminderSettings } from "../domain/reminders";
export { reminderDefaults } from "../domain/reminders";
export type { ReminderSettings, ReminderSnapshot } from "../domain/reminders";
export const getReminders = (signal?: AbortSignal) =>
  request<ReminderSnapshot>("/api/reminders", { signal }, true);
export const saveReminders = (settings: ReminderSettings) =>
  request<ReminderSnapshot>("/api/reminders", json("PUT", settings), true);
