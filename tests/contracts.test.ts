import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsInput,
  historyRow,
  normalizeBundle,
  trustedApiUrl,
} from "../src/domain/contracts";
import {
  createAttempt,
  completeAttempt,
  patchAnswer,
  questionIdentity,
} from "../src/domain/attempt";
import { previewBundle } from "../src/data/preview";
test("history matches the browser contract without obsolete completed/graded column names", () => {
  const a = completeAttempt(
      createAttempt(
        previewBundle,
        previewBundle.questions,
        120,
        "full",
        "owner",
        "attempt",
        1000,
      ),
      2000,
    ),
    row = historyRow(a);
  assert.ok("created_at" in row);
  assert.ok(!("graded_total" in row));
  assert.ok(!("completed_at" in row));
  assert.equal(row.user_id, "owner");
});
test("analytics never contains question wording or options", () => {
  const bundle = normalizeBundle(previewBundle),
    a = completeAttempt(
      patchAnswer(
        createAttempt(
          bundle,
          bundle.questions,
          120,
          "full",
          "owner",
          "id",
          1000,
        ),
        0,
        0,
      ),
      2000,
    );
  const encoded = JSON.stringify(analyticsInput(a));
  for (const q of bundle.questions) {
    assert.ok(!encoded.includes(q.question));
    for (const option of q.options.filter((o) => o.length > 5))
      assert.ok(!encoded.includes('"' + option + '"'));
  }
  assert.equal(analyticsInput(a).attempts[0].isCorrect, true);
});
test("theory never sends a fabricated selected option", () => {
  const q = {
    ...previewBundle.questions[0],
    type: "theory",
    options: [],
    correct: null,
  };
  const a = createAttempt(
    { ...previewBundle, questions: [q] },
    [q],
    60,
    "practice",
    "owner",
    "id",
    0,
  );
  a.answers[0] = 0;
  assert.equal(
    analyticsInput(completeAttempt(a, 1000)).attempts[0].selectedOptionIndex,
    null,
  );
});
test("private API token destination requires exact HTTPS origin", () => {
  const base = "https://76.13.110.6.nip.io";
  assert.equal(
    trustedApiUrl("/api/library/figures/pic.jpg", base),
    base + "/api/library/figures/pic.jpg",
  );
  assert.equal(trustedApiUrl(base + ".attacker.example/pic.jpg", base), null);
  assert.equal(trustedApiUrl("http://76.13.110.6.nip.io/pic.jpg", base), null);
});
test("stable question identity survives native content hydration", () => {
  const q = normalizeBundle(previewBundle).questions[0];
  assert.equal(
    questionIdentity(q),
    questionIdentity({ ...q, question: "", options: ["", "", "", ""] }),
  );
});
