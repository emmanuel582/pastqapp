import test from "node:test";
import assert from "node:assert/strict";
import fixtures from "./fixtures/waec-theory.json";
import {
  theoryLocation,
  theoryLabel,
  theoryGroupKey,
  questionUnits,
  theorySolution,
} from "../src/domain/theory";
import {
  buildSubjectSession,
  defaultSubjectSettings,
  subjectQuestionCount,
} from "../src/domain/subjectSession";
import { createAttempt, attemptSummary } from "../src/domain/attempt";
import { questionNumberLabel } from "../src/domain/review";
import { nativeBankFixture } from "./helpers/nativeBank";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import sanitizeHtml from "sanitize-html";
import katex from "katex";
import { mathCss } from "../src/data/mathCss";
const rich: { contentHtml?: (...args: any[]) => string } = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/services/richContent.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
  {
    exports: rich,
    require: (path: string) => {
      if (path === "sanitize-html") return sanitizeHtml;
      if (path === "katex") return katex;
      if (path === "../data/mathCss") return { mathCss };
      if (path === "./api") return { API_BASE: "https://example.test" };
      throw Error(path);
    },
  },
);
const contentHtml = rich.contentHtml!;
import type { Question } from "../src/domain/types";
const biology = fixtures.Biology.slice(0, 5) as Question[];
const chemistry = fixtures.Chemistry as Question[];

test("live WAEC hierarchy preserves parent, letter, Roman numeral, section and marks", () => {
  assert.deepEqual(
    biology.map((q, i) => theoryLabel(q, i)),
    ["1(a)(i)", "1(a)(ii)", "1(b)(i)", "1(b)(ii)", "1(c)"],
  );
  assert.equal(theoryLocation(biology[1]).marks, "2");
  assert.equal(theoryLabel(fixtures["English-Language"][0], 0), "1");
  assert.equal(
    theoryLocation(fixtures["English-Language"][0]).section,
    "SECTION A",
  );
  assert.match(
    questionNumberLabel(
      {
        questions: biology,
        answers: biology.map(() => null),
        written: biology.map(() => ""),
      },
      1,
      false,
    ),
    /Question 1\(a\)\(ii\)/,
  );
  assert.notEqual(
    theoryGroupKey(biology[0], 0),
    theoryGroupKey(chemistry[0], 0),
  );
  assert.notEqual(
    theoryGroupKey(biology[0], 0),
    theoryGroupKey({ ...biology[0], year: "2025" }, 0),
  );
});
test("selection and shuffle keep whole theory questions with source-ordered subparts", () => {
  const next = biology.map((q) => ({
    ...q,
    id: "next-" + q.id,
    orderIndex: Number(q.orderIndex) + 10,
    sourceAttributes: { ntxt: (q.sourceAttributes as any).ntxt },
    hierarchy: [
      { tag: "node", attributes: { ntxt: "2" } },
      { tag: "node", attributes: { ntxt: "a" } },
    ],
  }));
  const pool = [...biology, ...next];
  const settings = { ...defaultSubjectSettings(pool), count: "1" };
  assert.equal(subjectQuestionCount(pool, settings), 1);
  for (let n = 0; n < 12; n++) {
    const selected = buildSubjectSession(
      ["Biology"],
      { Biology: pool },
      { Biology: settings },
      true,
    );
    assert.equal(selected.length, 5);
    assert.equal(questionUnits(selected).length, 1);
    assert.deepEqual(
      selected.map((q) => q.orderIndex),
      [...selected]
        .sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex))
        .map((q) => q.orderIndex),
    );
  }
  const seen = new Set(biology.map((q) => String(q.practiceKey)));
  // Different practice keys are essential when constructing an independent source paper.
  const unseen = next.map((q, i) => ({ ...q, practiceKey: "unseen-" + i }));
  const selected = buildSubjectSession(
    ["Biology"],
    { Biology: [...biology, ...unseen] },
    { Biology: settings },
    false,
    seen,
  );
  assert.ok(selected.every((q) => String(q.id).startsWith("next-")));
});
test("uploaded composite labels are preserved without extracting labels from formulae or prose", () => {
  const base = {
    subject: "Math",
    question: "Find sin(a) + (ii)",
    options: [],
    type: "theory",
    explanation: "",
  };
  assert.equal(
    theoryLabel({ ...base, questionNumber: "2(a)(ii)" }, 0),
    "2(a)(ii)",
  );
  assert.equal(theoryLabel(base, 4), "5");
  assert.equal(
    questionUnits([
      { ...base, id: 1, questionNumber: "i" },
      { ...base, id: 2, questionNumber: "i" },
    ]).length,
    2,
  );
  assert.equal(
    questionUnits([
      { ...base, id: 1 },
      { ...base, id: 2 },
    ]).length,
    2,
  );
});
test("revealing a source answer never fabricates an attempted or graded written answer", () => {
  let a = createAttempt(
    { id: "qa", title: "Theory", questions: biology },
    biology,
    600,
    "practice",
    "qa",
    "paper",
  );
  a = { ...a, revealed: [true] };
  assert.equal(attemptSummary(a).answered, 0);
  assert.equal(attemptSummary(a).percent, null);
  a = { ...a, written: ["Pollination", "My explanation", "", "", ""] };
  assert.equal(attemptSummary(a).answered, 2);
  assert.equal(attemptSummary(a).ungraded, 2);
  assert.deepEqual(a.answers, [null, null, null, null, null]);
});
test("theory source solutions avoid duplicate prose and retain rich answer formatting", () => {
  const q = biology[0],
    solution = theorySolution(q);
  assert.equal(solution.text, q.answerText);
  assert.equal(solution.explanation, "");
  const math = {
    ...q,
    answerText: "x2",
    explanation: "x2",
    explanationHtml: "x<sup>2</sup>",
  };
  assert.equal(theorySolution(math).html, "x<sup>2</sup>");
  assert.equal(
    theorySolution({ ...q, explanation: "Different explanation" }).explanation,
    "Different explanation",
  );
});
test("native SQLite keeps source labels and hydrates pre-upgrade downloads entirely offline", async () => {
  const { bank, sqlite } = nativeBankFixture(),
    hash = "d".repeat(64),
    bundle = { id: "waec-theory", title: "WAEC Theory", questions: [] };
  await bank.indexPart(
    "qa",
    bundle,
    "v1",
    { hash, count: biology.length, offset: 0 },
    { questions: biology, assets: {} },
  );
  await bank.commitIndex(
    "qa",
    bundle,
    "v1",
    [hash],
    biology.length,
    1000,
    false,
  );
  let index = await bank.readIndex("qa", bundle.id);
  assert.deepEqual(
    Array.from(index.questions, (q: Question, i: number) => theoryLabel(q, i)),
    biology.map((q, i) => theoryLabel(q, i)),
  );
  sqlite.exec(
    "UPDATE bank_questions SET summary=json_remove(summary,'$.theoryLocation','$.orderIndex')",
  );
  index = await bank.readIndex("qa", bundle.id);
  assert.deepEqual(
    Array.from(index.questions, (q: Question, i: number) => theoryLabel(q, i)),
    biology.map((q, i) => theoryLabel(q, i)),
  );
  assert.equal(
    subjectQuestionCount(index.questions, {
      ...defaultSubjectSettings(index.questions),
      count: "all",
    }),
    1,
  );
  assert.equal(
    (
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM bank_questions WHERE json_extract(summary,'$.theoryLocation') IS NOT NULL",
        )
        .get() as { n: number }
    ).n,
    biology.length,
  );
  const full = await bank.resolveQuestion("qa", index.questions[1]);
  assert.equal(full.question.questionHtml, biology[1].questionHtml);
  assert.equal(full.question.answerText, biology[1].answerText);
  assert.equal(theoryLabel(full.question, 1), "1(a)(ii)");
  sqlite.close();
});
test("source superscripts, subscripts and table cells remain meaningful after sanitization", () => {
  const clean = contentHtml(
    "",
    '<div>x<span style="position:relative;top:-6px">2</span> + H<span style="vertical-align:sub">2</span>O<table><tr><td rowspan="2">Data</td></tr></table><script>bad()</script></div>',
    undefined,
  );
  assert.match(clean, /<sup>2<\/sup>/);
  assert.match(clean, /<sub>2<\/sub>/);
  assert.match(clean, /rowspan="2"/);
  assert.doesNotMatch(clean, /<script/);
});
