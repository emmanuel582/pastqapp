import { missingPageInsertion } from "../src/domain/processing";
import { materialMimeType } from "../src/domain/files";
import { matchesSavedQuestion } from "../src/domain/search";
import {
  groupDownloadPapers,
  savedDownloadSelection,
} from "../src/domain/downloads";
import test from "node:test";
import assert from "node:assert/strict";
import { topicBreakdown } from "../src/domain/breakdown";
import { matchesQuestion, matchesBundle } from "../src/domain/search";
import {
  subjectPool,
  buildSubjectSession,
  defaultSubjectSettings,
} from "../src/domain/subjectSession";
import { mergeHistory } from "../src/domain/history";
import {
  createAttempt,
  completeAttempt,
  attemptSummary,
} from "../src/domain/attempt";
import type { Question } from "../src/domain/types";
const q = (id: number, extra: Partial<Question> = {}): Question => ({
  id,
  subject: "Chemistry",
  topic: "Atomic structure",
  question: "Which particle carries a positive charge?",
  options: ["Proton", "Electron"],
  correct: 0,
  explanation: "A proton is positive.",
  year: "2024",
  paper: "Paper 1",
  ...extra,
});
test("human journey: find by wording, option, subject, topic, year and normalized HTML", () => {
  const question = q(1, { question: "<p>Café <b>atomic</b> structure</p>" });
  for (const term of [
    "cafe",
    "atomic structure",
    "CHEMISTRY",
    "2024",
    "electron",
    "atomic chemistry",
  ])
    assert.equal(matchesQuestion(question, term), true, term);
  assert.equal(matchesQuestion(question, "biology"), false);
  assert.equal(
    matchesBundle(
      {
        id: "b",
        title: "My class notes",
        examType: "Tutorial",
        questions: [],
        subjects: ["Chemistry"],
      },
      "chemistry",
    ),
    true,
  );
});
test("human journey: topic study includes dated papers across years and excludes unselected topics", () => {
  const pool = [
    q(1),
    q(2, { year: "2023" }),
    q(3, { year: null, sourceBank: "lecture" }),
    q(4, { topic: "Organic chemistry" }),
  ];
  const settings = {
    ...defaultSubjectSettings(pool),
    studyBy: "topic" as const,
    topics: ["Atomic structure"],
    count: "all",
  };
  assert.deepEqual(
    subjectPool(pool, settings).map((x) => x.id),
    [1, 2, 3],
  );
  assert.equal(
    buildSubjectSession(
      ["Chemistry"],
      { Chemistry: pool },
      { Chemistry: settings },
      false,
    ).length,
    3,
  );
  assert.equal(subjectPool(pool, { ...settings, topics: [] }).length, 0);
  assert.deepEqual(
    subjectPool(pool, {
      ...settings,
      studyBy: "paper",
      year: "2024",
      paper: "Paper 1",
      topics: null,
    }).map((x) => x.id),
    [1, 4],
  );
});
test("human journey: upload-style undated theory and MCQ material produces honest topic totals", () => {
  const questions = [
    q(1),
    q(2),
    q(3),
    q(4, { correct: null }),
    q(5, { type: "theory", options: [], correct: null }),
    q(6, { subject: "Physics", topic: "Atomic structure" }),
    q(7, { topic: undefined, section: "Revision" }),
  ];
  const rows = topicBreakdown({
    questions,
    answers: [0, 1, null, 1, null, 0, null],
    written: ["", "", "", "", "My derivation", "", ""],
  });
  assert.deepEqual(
    rows.find(
      (r) => r.subject === "Chemistry" && r.topic === "Atomic structure",
    ),
    {
      subject: "Chemistry",
      topic: "Atomic structure",
      total: 5,
      attempted: 4,
      correct: 1,
      missed: 1,
      unanswered: 1,
      ungraded: 2,
    },
  );
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.total, row.attempted + row.unanswered);
    assert.equal(row.attempted, row.correct + row.missed + row.ungraded);
  }
});
test("human journey: completed local and browser results merge once, preserve local review and sort newest", () => {
  const attempt = completeAttempt(
    createAttempt(
      { id: "b", title: "Uploaded notes", questions: [q(1)] },
      [q(1)],
      1200,
      "practice",
      "owner",
      "same",
      1000,
    ),
    1100,
  );
  const header = {
    ...attempt,
    questionCount: 1,
    summary: attemptSummary(attempt),
  };
  const rows = mergeHistory(
    [header],
    [
      {
        id: "same",
        title: "Cloud old title",
        score: 0,
        total_questions: 1,
        completed_at: new Date(1100).toISOString(),
      },
      {
        id: "browser",
        title: "Browser session",
        score: 7,
        total_questions: 10,
        completed_at: new Date(2000).toISOString(),
      },
    ],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "browser");
  assert.equal(rows[0].percent, 70);
  assert.equal(rows[1].local, true);
  assert.equal(rows[1].title, "Uploaded notes");
});

test("written answers are counted as attempted and ungraded in the overall result", () => {
  const theory = q(9, { type: "theory", options: [], correct: null });
  const attempt = createAttempt(
    { id: "uploaded", title: "Class notes", questions: [theory] },
    [theory],
    1200,
    "practice",
    "owner",
    "written",
  );
  attempt.written[0] = "My answer";
  const result = attemptSummary(attempt);
  assert.equal(result.answered, 1);
  assert.equal(result.ungraded, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.percent, null);
});

test("download choices preserve a saved paper when the server changes chunk hashes", () => {
  const part = {
    hash: "new",
    subject: "Biology",
    year: "2024",
    paper: "Paper 1",
    count: 100,
    bytes: 1000,
    offset: 0,
  };
  const manifest: any = {
    parts: [part, { ...part, hash: "other", year: "2023" }],
  };
  const saved: any = {
    partialDownload: true,
    downloadedParts: ["old"],
    downloadedSelection: [{ ...part, hash: "old" }],
  };
  assert.deepEqual(savedDownloadSelection(manifest, saved), ["new"]);
  assert.deepEqual(
    savedDownloadSelection(manifest, { ...saved, partialDownload: false }),
    ["new", "other"],
  );
});
test("download details combine internal chunks into a paper and sum all question/byte counts", () => {
  const part = {
    hash: "a",
    subject: "Biology",
    year: "2024",
    paper: "Paper 1",
    count: 100,
    bytes: 1000,
    offset: 0,
  };
  const rows = groupDownloadPapers([
    part,
    { ...part, hash: "b", offset: 100, count: 40, bytes: 400 },
    { ...part, hash: "c", year: "2023" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "2024 · Paper 1");
  assert.equal(rows[0].count, 140);
  assert.equal(rows[0].bytes, 1400);
  assert.deepEqual(rows[0].hashes, ["a", "b"]);
});

test("saved question search includes topics, sections and notes together", () => {
  assert.equal(
    matchesSavedQuestion(q(1), "Revise this on Friday", "atomic friday"),
    true,
  );
  assert.equal(
    matchesSavedQuestion(
      q(1, { topic: undefined, section: "Revision" }),
      "",
      "revision",
    ),
    true,
  );
  assert.equal(matchesSavedQuestion(q(1), "", "biology"), false);
});

test("native file picking recognizes photos and JSON when providers omit a usable MIME type", () => {
  assert.equal(materialMimeType("scan.JPG"), "image/jpeg");
  assert.equal(
    materialMimeType("book.pdf", "application/octet-stream"),
    "application/pdf",
  );
  assert.equal(materialMimeType("questions.json"), "application/json");
  assert.equal(materialMimeType("photo.heic", ""), "image/heic");
  assert.equal(materialMimeType("unknown.bin"), "application/octet-stream");
});

test("missing-page replies insert before the target page or append, and never guess a missing target", () => {
  const session: any = { pages: [{ id: "page2", index: 1, status: "done" }] };
  assert.equal(
    missingPageInsertion(session, {
      id: "f",
      type: "missing_page",
      status: "open",
      message: "",
      pageId: "page2",
    }),
    1,
  );
  assert.equal(
    missingPageInsertion(session, {
      id: "f",
      type: "missing_page",
      status: "open",
      message: "",
    }),
    undefined,
  );
  assert.throws(
    () =>
      missingPageInsertion(session, {
        id: "f",
        type: "missing_page",
        status: "open",
        message: "",
        pageId: "unknown",
      }),
    /position/,
  );
});
