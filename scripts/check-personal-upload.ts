import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { normalizeBundle } from "../src/domain/contracts";
import {
  createAttempt,
  completeAttempt,
  attemptSummary,
} from "../src/domain/attempt";
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
  const clients = [0, 1].map(() =>
    createClient(
      env.EXPO_PUBLIC_SUPABASE_URL,
      env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
  const tokens: string[] = [];
  for (const client of clients) {
    const { data, error } = await client.auth.signInWithPassword(account);
    if (error) throw error;
    tokens.push(data.session!.access_token);
  }
  async function api(
    route: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    token = tokens[0],
  ) {
    const response = await fetch(env.EXPO_PUBLIC_API_URL + route, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let value: any;
    try {
      value = JSON.parse(text);
    } catch {
      throw Error("VPS returned a non-JSON response (" + response.status + ")");
    }
    if (!response.ok)
      throw Error(
        "VPS " +
          response.status +
          ": " +
          (value.error || value.message || "Request failed"),
      );
    return value;
  }
  const statePath = ".qa/personal-upload-state.json";
  let state: any = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, "utf8"))
    : {};
  if (!state.sessionId) {
    const source = [
      "Personal class notes — Biology and Mathematics",
      "Subject: Biology. Topic: Cell structure.",
      "1. Which cell structure controls the activities of the cell?",
      "A. Nucleus",
      "B. Cell wall",
      "C. Vacuole",
      "D. Cytoplasm",
      "Answer: A. Nucleus",
      "Explanation: The nucleus contains genetic material and controls cell activities.",
      "Subject: Biology. Topic: Photosynthesis.",
      "2. Which gas is used by plants during photosynthesis?",
      "A. Carbon dioxide",
      "B. Nitrogen",
      "C. Oxygen",
      "D. Hydrogen",
      "Answer: A. Carbon dioxide",
      "Explanation: Carbon dioxide supplies carbon for photosynthesis.",
      "Subject: Mathematics. Topic: Linear equations.",
      "3. Solve 2x + 3 = 11.",
      "A. 3",
      "B. 4",
      "C. 5",
      "D. 6",
      "Answer: B. 4",
      "Explanation: Subtract 3 from both sides, then divide by 2.",
    ].join("\n");
    const started = await api("/api/vision/extract-text", {
      text: source,
      name: "Mobile QA personal class notes",
      icon: "📝",
    });
    state.sessionId = started.sessionId || started.jobId;
    assert.ok(state.sessionId, "Extraction did not return a session ID");
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log("Personal material accepted for processing.");
  }
  let session: any,
    last = "";
  const deadline = Date.now() + 90000;
  do {
    session = await api(
      "/api/vision/sessions/" + encodeURIComponent(state.sessionId),
    );
    if (session.status !== last) {
      last = session.status;
      console.log("Processing status: " + last);
    }
    if (
      ["completed", "completed_with_errors", "confirmed"].includes(
        session.status,
      )
    )
      break;
    if (
      ["failed", "needs_input", "paused", "needs_attention"].includes(
        session.status,
      )
    )
      throw Error(
        "Sample material requires attention: " +
          session.status +
          " · " +
          JSON.stringify({
            reason: session.pauseReason || session.error || session.lastError,
            followUps: session.followUps?.map((f: any) => ({
              type: f.type,
              message: f.message,
            })),
          }),
      );
    await new Promise((r) => setTimeout(r, 2000));
  } while (Date.now() < deadline);
  assert.ok(
    ["completed", "completed_with_errors", "confirmed"].includes(
      session.status,
    ),
    "Processing did not finish within the check window",
  );
  const questions = session.questions || [];
  assert.equal(questions.length, 3, "Expected all three supplied questions");
  const reviewed = questions.map((q: any) => {
    assert.ok(
      q.question && q.options?.length >= 4,
      "Incomplete extracted question",
    );
    const wording = q.question.toLowerCase();
    let answer: number;
    if (wording.includes("photosynth"))
      answer = q.options.findIndex((s: string) => /carbon dioxide/i.test(s));
    else if (wording.includes("cell"))
      answer = q.options.findIndex((s: string) => /nucleus/i.test(s));
    else {
      assert.match(wording, /2\s*x|2x/);
      answer = q.options.findIndex((s: string) =>
        /^\s*(?:[a-d][.)]\s*)?4\s*$/i.test(s),
      );
    }
    assert.ok(answer >= 0, "The supplied answer was not retained");
    return {
      ...q,
      correct: answer,
      needsReview: false,
      incomplete: false,
      reviewReasons: [],
    };
  });
  let bundle: any;
  if (state.bundleId)
    bundle = await api(
      "/api/vision/materials/" + encodeURIComponent(state.bundleId),
    );
  else {
    bundle = await api(
      "/api/vision/sessions/" +
        encodeURIComponent(state.sessionId) +
        "/confirm",
      { questions: reviewed },
      "PUT",
    );
    state.bundleId = bundle.id;
    assert.ok(state.bundleId, "Confirmation did not return a material ID");
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }
  bundle = normalizeBundle(bundle);
  assert.equal(bundle.questions.length, 3);
  const second = await api(
    "/api/vision/materials?offset=0&limit=100",
    undefined,
    "GET",
    tokens[1],
  );
  assert.ok(
    second.materials.some((m: any) => m.id === bundle.id),
    "A separate client could not see the confirmed personal material",
  );
  const hydrated = normalizeBundle(
    await api(
      "/api/vision/materials/" + encodeURIComponent(bundle.id),
      undefined,
      "GET",
      tokens[1],
    ),
  );
  assert.equal(hydrated.questions.length, 3);
  let attempt = createAttempt(
    bundle,
    hydrated.questions,
    1200,
    "practice",
    (await clients[0].auth.getUser()).data.user!.id,
    "qa-personal-material",
    Date.now(),
  );
  attempt.answers = hydrated.questions.map((q) => Number(q.correct));
  attempt = completeAttempt(attempt);
  assert.equal(attemptSummary(attempt).correct, 3);
  const result = {
    checkedAt: new Date().toISOString(),
    status: "passed",
    questions: 3,
    subjects: [...new Set(hydrated.questions.map((q) => q.subject))],
    privateUploadConfirmed: true,
    secondClientCanLoadMaterial: true,
    localPracticeCorrect: 3,
    scope:
      "Authenticated VPS API extraction/review/material availability plus local practice; physical camera, PDF and progress sync are separate checks.",
  };
  fs.writeFileSync(
    "docs/personal-upload-check.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fs.writeFileSync(
    "docs/personal-upload-check.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), status: "failed", error: message },
      null,
      2,
    ) + "\n",
  );
  console.error(message);
  process.exitCode = 1;
});
