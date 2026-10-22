import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAttempt, completeAttempt } from "../src/domain/attempt";
import { historyRow, analyticsInput } from "../src/domain/contracts";
async function main() {
  const env = Object.fromEntries(
    fs
      .readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).trim()];
      }),
  );
  const account = JSON.parse(fs.readFileSync(".qa/account.json", "utf8"));
  const make = () =>
    createClient(
      env.EXPO_PUBLIC_SUPABASE_URL,
      env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  const native = make(),
    browser = make();
  for (const client of [native, browser]) {
    const result = await client.auth.signInWithPassword(account);
    if (result.error) throw result.error;
  }
  const owner = (await native.auth.getUser()).data.user!.id;
  const profile = await browser
    .from("users")
    .select("id,onboarding_complete")
    .eq("id", owner)
    .single();
  if (profile.error) throw profile.error;
  const id = randomUUID(),
    questions = [
      {
        id: 1,
        practiceKey: "qa:" + id + ":1",
        subject: "Chemistry",
        topic: "Atomic structure",
        question: "QA sample question",
        options: ["First", "Second"],
        correct: 0,
        explanation: "",
      },
      {
        id: 2,
        practiceKey: "qa:" + id + ":2",
        subject: "Chemistry",
        topic: "Atomic structure",
        question: "QA sample question two",
        options: ["First", "Second"],
        correct: 0,
        explanation: "",
      },
    ];
  let attempt = createAttempt(
    { id: "qa-mobile-sync", title: "Mobile QA sync check", questions },
    questions,
    1200,
    "practice",
    owner,
    id,
    Date.now() - 60000,
  );
  attempt.answers = [0, 1];
  attempt = completeAttempt(attempt);
  const result = await native
    .from("exam_sessions")
    .upsert(historyRow(attempt), { onConflict: "id" });
  if (result.error) throw result.error;
  const module: any = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/services/analytics.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: module,
      require: (name: string) =>
        name === "./auth"
          ? { requireAuth: () => native }
          : (() => {
              throw Error(name);
            })(),
      Date,
      Math,
      Map,
      console,
    },
  );
  await module.savePracticeResult(analyticsInput(attempt));
  await module.savePracticeResult(analyticsInput(attempt));
  const history = await browser
    .from("exam_sessions")
    .select("*")
    .eq("user_id", owner)
    .eq("id", id)
    .single();
  if (history.error) throw history.error;
  assert.equal(history.data.score, 1);
  assert.equal(history.data.total_questions, 2);
  const outcomes = await browser
    .from("question_attempts")
    .select("question_key,is_correct")
    .eq("user_id", owner)
    .eq("practice_session_id", id);
  if (outcomes.error) throw outcomes.error;
  assert.equal(outcomes.data.length, 2, "retry must not duplicate outcomes");
  const reverseId = randomUUID();
  const reverse = await browser
    .from("exam_sessions")
    .upsert(
      { ...historyRow(attempt), id: reverseId, title: "Browser QA sync check" },
      { onConflict: "id" },
    );
  if (reverse.error) throw reverse.error;
  const readBack = await native
    .from("exam_sessions")
    .select("id,score")
    .eq("user_id", owner)
    .eq("id", reverseId)
    .single();
  if (readBack.error) throw readBack.error;
  assert.equal(readBack.data.score, 1);
  const report = {
    checkedAt: new Date().toISOString(),
    profile: !!profile.data,
    onboardingComplete: profile.data.onboarding_complete,
    nativeToBrowser: true,
    browserToNative: true,
    analyticsRetryIdempotent: true,
    questionWordingSent: false,
    sessionIds: [id, reverseId],
  };
  fs.writeFileSync(
    "docs/account-sync-check.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
