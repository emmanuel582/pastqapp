import fs from "node:fs";
import assert from "node:assert/strict";
import {
  theoryLabel,
  theoryLocation,
  questionUnits,
} from "../src/domain/theory";
import type { CbtQuestion } from "../src/domain/cbtFilters";
const file = process.argv[2];
if (!file) throw Error("Pass the WAEC export or a metadata audit JSON file.");
const data = JSON.parse(fs.readFileSync(file, "utf8")),
  rows = (data.rows || data.questions) as CbtQuestion[];
let nested = 0;
for (const [i, q] of rows.entries()) {
  const parts = String(q.sourceQuestionId || "")
    .split(">")
    .slice(3);
  const start = parts.findIndex((p) => /^\d+[a-z]?$/i.test(p));
  const path = start < 0 ? [] : parts.slice(start);
  if (path.length) {
    const expected =
      path[0] +
      path
        .slice(1)
        .map((p) => `(${p})`)
        .join("");
    assert.equal(theoryLabel(q, i), expected, String(q.sourceQuestionId));
    if (path.length > 1) nested++;
  }
  assert.ok(theoryLabel(q, i).trim());
  assert.equal(
    theoryLabel({ ...q, theoryLocation: theoryLocation(q) }, i),
    theoryLabel(q, i),
  );
}
console.log(
  JSON.stringify(
    {
      records: rows.length,
      nestedParts: nested,
      questionGroups: questionUnits(rows).length,
      allLabelsMatchSource: true,
    },
    null,
    2,
  ),
);
