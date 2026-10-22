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
    const attempt = await readAttempt(owner, row.id),
      summary = historyRow(attempt),
      input = analyticsInput(attempt);
    const { error } = await client
      .from("exam_sessions")
      .upsert(summary, { onConflict: "id" });
    if (error) throw error;
    await savePracticeResult(input);
    await records.remove(owner, "history-outbox", attempt.id);
    await records.write(owner, "cohort-outbox", attempt.id, {
      attempts: input.attempts.map(({ questionKey, isCorrect }) => ({
        questionKey,
        isCorrect,
      })),
    });
  }
  const headers = await records.list<{ id: string; status: string }>(
    owner,
    "attempt",
  );
  for (const header of headers) {
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
        await records.write(owner, "cohort-outbox", header.id, {
          ...payload,
          offset: offset + 500,
        });
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
  return (data || []).map((row) => ({ ...row, completed_at: row.created_at }));
}
