import { request, json } from "./api";
import * as records from "../storage/records";
import type { ReminderSnapshot, ReminderSettings } from "../domain/reminders";
export { reminderDefaults } from "../domain/reminders";
export type { ReminderSettings, ReminderSnapshot } from "../domain/reminders";
export const getReminders = (owner: string, signal?: AbortSignal) =>
  request<ReminderSnapshot>("/api/reminders", { signal, owner }, true);
const saving = new Map<string, Promise<ReminderSnapshot>>();
/** Keep manual saves and background retries in order for each account. */
export function saveReminders(owner: string, settings: ReminderSettings) {
  const work = (saving.get(owner)?.catch(() => {}) || Promise.resolve()).then(
    async () => {
      const current = await records.read<ReminderSettings>(
        owner,
        "reminder-outbox",
        "current",
      );
      if (!current || JSON.stringify(current) !== JSON.stringify(settings))
        throw Error("Reminder settings changed. Sync will retry.");
      return request<ReminderSnapshot>(
        "/api/reminders",
        { ...json("PUT", settings), owner },
        true,
      );
    },
  );
  saving.set(owner, work);
  void work
    .finally(() => {
      if (saving.get(owner) === work) saving.delete(owner);
    })
    .catch(() => {});
  return work;
}
