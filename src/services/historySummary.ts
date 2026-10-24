import { historyRow } from "../domain/contracts";
import type { Attempt } from "../domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Match the live legacy summary table without requiring optional analytics columns. */
export function legacyHistoryRow(attempt: Attempt) {
  const full = historyRow(attempt);
  return {
    id: full.id,
    user_id: full.user_id,
    material_name: full.title,
    subject: attempt.questions[0]?.subject || null,
    year: /^\d{4}$/.test(String(attempt.questions[0]?.year))
      ? Number(attempt.questions[0].year)
      : null,
    score: full.score,
    total_questions: full.total_questions,
    time_spent_seconds: full.duration_seconds,
    completed: true,
    created_at: full.created_at,
  };
}
export async function saveHistorySummary(
  client: SupabaseClient,
  attempt: Attempt,
) {
  const row = legacyHistoryRow(attempt),
    { error } = await client.from("exam_sessions").insert(row);
  if (!error) return;
  if (error.code !== "23505") throw error;
  // A timed-out response may have committed. Verify ownership and immutable values before acknowledging a retry.
  const { data, error: readError } = await client
    .from("exam_sessions")
    .select(
      "id,material_name,score,total_questions,time_spent_seconds,completed",
    )
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .single();
  if (readError) throw readError;
  if (
    !data ||
    data.score !== row.score ||
    data.total_questions !== row.total_questions ||
    data.time_spent_seconds !== row.time_spent_seconds ||
    data.completed !== true
  )
    throw Error("This saved result differs from the server copy.");
}
export function missingAnalyticsSchema(error: unknown) {
  const value = error as { code?: string; message?: string };
  return (
    ["PGRST205", "42P01"].includes(value?.code || "") &&
    /practice_sessions|question_attempts|student_topic_mastery|learning_events/i.test(
      value?.message || "",
    )
  );
}
