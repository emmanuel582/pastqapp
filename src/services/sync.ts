import * as records from "../storage/records";
import { syncHistory } from "./history";
import { syncReports } from "./reports";
import {
  saveReminders,
  getReminders,
  type ReminderSettings,
} from "./reminders";
import { refreshReminders } from "./notifications";
import { listAttempts } from "../storage/practice";
import { request, json } from "./api";
export async function syncAccount(owner: string) {
  const results = await Promise.allSettled([
    syncHistory(owner),
    syncReports(owner),
    syncReminders(owner),
  ]);
  const failed = results.find((r) => r.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
async function syncReminders(owner: string) {
  const pending = await records.read<ReminderSettings>(
    owner,
    "reminder-outbox",
    "current",
  );
  if (pending) {
    await saveReminders(owner, pending);
    await records.compareAndSwap(
      owner,
      "reminder-outbox",
      "current",
      pending,
      null,
    );
  }
  const attempts = (await listAttempts(owner)).filter(
    (a) => a.status === "completed",
  );
  if (attempts.length)
    await request(
      "/api/reminders/activity",
      {
        ...json("POST", {
          sessions: attempts.slice(0, 100).map((a) => ({
            id: a.id,
            at: new Date(a.completedAt!).toISOString(),
            total: a.summary.graded,
            score: a.summary.correct,
            durationSeconds: Math.round((a.completedAt! - a.startedAt) / 1000),
            subject: a.title.slice(0, 100),
          })),
        }),
        owner,
      },
      true,
    );
  const local = await records.read<ReminderSettings>(
    owner,
    "reminders",
    "current",
  );
  if (local?.enabled) {
    const remote = await getReminders(owner);
    const studied = attempts.map((a) => {
      const d = new Date(a.completedAt!);
      return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    });
    await records.write(owner, "reminder-preview", "current", remote.preview);
    await refreshReminders(owner, studied);
  }
}
