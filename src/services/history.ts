import { saveHistorySummary, missingAnalyticsSchema } from "./historySummary";
import { withSession } from "../storage/sessionQueue";
import * as records from "../storage/records";
import { readAttempt } from "../storage/practice";
import { supabase } from "./auth";
import { savePracticeResult } from "./analytics";
import { historyRow, analyticsInput } from "../domain/contracts";
import { request, json } from "./api";
export type PracticeSummary = {
  id: string;
  title: string;
  score: number;
  total_questions: number;
  graded_total?: number;
  completed_at: string;
  source_bundle_id?: string;
};
const running = new Map<string, Promise<void>>();
export function syncHistory(owner: string) {
  const pending = running.get(owner);
  if (pending) return pending;
  const task = sync(owner).finally(() => running.delete(owner));
  running.set(owner, task);
  return task;
}
async function sync(owner: string) {
  if (!supabase) return;
  const client = supabase;
  for (const row of await records.list<{ id: string }>(
    owner,
    "history-outbox",
  )) {
    if ((await client.auth.getSession()).data.session?.user.id !== owner)
      return;
    if (await records.read(owner, "attempt-deleted", row.id)) continue;
    const attempt = await readAttempt(owner, row.id).catch(async (error) => {
      if (await records.read(owner, "attempt-deleted", row.id)) return null;
      throw error;
    });
    if (!attempt) continue;
    const input = analyticsInput(attempt);
    if (!(await records.read(owner, "history-summary-synced", attempt.id))) {
      await saveHistorySummary(client, attempt);
      await records.write(owner, "history-summary-synced", attempt.id, true);
    }
    const capability = await records.read<{ retryAfter: number }>(
      owner,
      "analytics-schema",
      "current",
    );
    if (capability && capability.retryAfter > Date.now()) continue;
    try {
      await savePracticeResult(input);
      await records.remove(owner, "analytics-schema", "current");
    } catch (error) {
      if (!missingAnalyticsSchema(error)) throw error;
      // Keep the detailed outcomes in the durable outbox until cloud tables are installed.
      await records.write(owner, "analytics-schema", "current", {
        retryAfter: Date.now() + 3600000,
      });
      continue;
    }
    await records.remove(owner, "history-outbox", attempt.id);
    await withSession(owner, attempt.id, async () => {
      if (await records.read(owner, "attempt-deleted", attempt.id)) return;
      await records.write(owner, "cohort-outbox", attempt.id, {
        attempts: input.attempts.map(({ questionKey, isCorrect }) => ({
          questionKey,
          isCorrect,
        })),
      });
    });
  }
  const headers = await records.list<{ id: string; status: string }>(
    owner,
    "attempt",
  );
  for (const header of headers) {
    if (await records.read(owner, "attempt-deleted", header.id)) continue;
    const payload = await records.read<{
      attempts: { questionKey: string; isCorrect: boolean | null }[];
      offset?: number;
    }>(owner, "cohort-outbox", header.id);
    if (payload) {
      for (
        let offset = payload.offset || 0;
        offset < payload.attempts.length;
        offset += 500
      ) {
        if ((await client.auth.getSession()).data.session?.user.id !== owner)
          return;
        await request(
          "/api/recommendations/attempts",
          json("POST", {
            attempts: payload.attempts.slice(offset, offset + 500),
          }),
          true,
        );
        await withSession(owner, header.id, async () => {
          if (await records.read(owner, "attempt-deleted", header.id)) return;
          await records.write(owner, "cohort-outbox", header.id, {
            ...payload,
            offset: offset + 500,
          });
        });
        if (await records.read(owner, "attempt-deleted", header.id)) break;
      }
      await records.remove(owner, "cohort-outbox", header.id);
    }
  }
}
export async function remoteHistory(owner: string): Promise<PracticeSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exam_sessions")
    .select("*")
    .eq("user_id", owner)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    title: row.title || row.material_name || "Practice",
    completed_at: row.created_at,
  }));
}
