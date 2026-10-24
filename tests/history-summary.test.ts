import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyHistoryRow,
  saveHistorySummary,
  missingAnalyticsSchema,
} from "../src/services/historySummary";
import { createAttempt, completeAttempt } from "../src/domain/attempt";
import { previewBundle } from "./fixtures/questions";
const attempt = completeAttempt(
  createAttempt(
    previewBundle,
    previewBundle.questions,
    120,
    "full",
    "owner",
    "id",
    1000,
  ),
  2000,
);
test("summary storage matches the live schema and sends no question content", () => {
  const row = legacyHistoryRow(attempt);
  assert.equal(row.material_name, attempt.title);
  assert.equal(row.time_spent_seconds, 1);
  assert.equal(row.completed, true);
  assert.deepEqual(
    Object.keys(row).sort(),
    [
      "id",
      "user_id",
      "material_name",
      "subject",
      "year",
      "score",
      "total_questions",
      "time_spent_seconds",
      "completed",
      "created_at",
    ].sort(),
  );
  assert.ok(!JSON.stringify(row).includes(attempt.questions[0].question));
});
test("a response-lost insert is acknowledged only after owner-filtered identical summary readback", async () => {
  const row = legacyHistoryRow(attempt),
    filters: any[] = [];
  let reads = 0;
  const chain: any = {
    eq: (key: string, value: string) => {
      filters.push([key, value]);
      return chain;
    },
    single: async () => {
      reads++;
      return { data: row, error: null };
    },
  };
  const client: any = {
    from: (table: string) => {
      assert.equal(table, "exam_sessions");
      return {
        insert: async () => ({ error: { code: "23505" } }),
        select: () => chain,
      };
    },
  };
  await saveHistorySummary(client, attempt);
  assert.equal(reads, 1);
  assert.deepEqual(filters, [
    ["id", attempt.id],
    ["user_id", "owner"],
  ]);
  row.score++;
  await assert.rejects(saveHistorySummary(client, attempt), /differs/);
});
test("missing analytics tables can be deferred; permission, auth and unrelated errors are never swallowed", () => {
  assert.equal(
    missingAnalyticsSchema({
      code: "PGRST205",
      message:
        "Could not find the table 'public.practice_sessions' in the schema cache",
    }),
    true,
  );
  for (const error of [
    { code: "42501", message: "permission denied question_attempts" },
    { code: "PGRST205", message: "missing users" },
    new Error("network"),
  ])
    assert.equal(missingAnalyticsSchema(error), false);
});
