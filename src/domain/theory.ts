import type { CbtQuestion } from "./cbtFilters";

export interface TheoryLocation {
  path: string[];
  section: string;
  paper: string;
  marks: string;
}
export const isWrittenQuestion = (q: CbtQuestion) =>
  [
    "theory",
    "short_answer",
    "long_answer",
    "essay",
    "structured",
    "fill_blank",
  ].includes(String(q.type || ""));

/** Read source structure, never guess subparts from prose, formulae or answer text. */
export function theoryLocation(q: CbtQuestion): TheoryLocation {
  const cached = q.theoryLocation as TheoryLocation | undefined;
  if (cached && Array.isArray(cached.path)) return cached;
  const hierarchy = Array.isArray(q.hierarchy) ? q.hierarchy : [];
  const parents = hierarchy.flatMap((node) =>
    node?.tag === "node" && node.attributes?.ntxt != null
      ? [String(node.attributes.ntxt).trim()]
      : [],
  );
  const attrs = q.sourceAttributes as Record<string, unknown> | undefined;
  const leaf = String(attrs?.ntxt ?? q.questionNumber ?? "").trim();
  let labels = [...parents, ...(leaf ? [leaf] : [])];
  if (
    !parents.length &&
    typeof q.sourceQuestionId === "string" &&
    q.sourceQuestionId.startsWith("theory>")
  )
    labels = q.sourceQuestionId.split(">").slice(3);
  // Uploaded questions may supply a complete label directly, e.g. 1(a)(ii).
  if (labels.length === 1 && /^\d+(?:\([a-z0-9]+\))+$/i.test(labels[0]))
    labels = labels[0].match(/\d+|[a-z]+/gi) || labels;
  const start = labels.findIndex((label) => /^\d+[a-z]?$/i.test(label));
  const path = start < 0 ? (leaf ? [leaf] : []) : labels.slice(start);
  const section = start > 0 ? labels.slice(0, start).join(" · ") : "";
  const fields = q.sourceFields as Record<string, unknown> | undefined;
  const mark = String(fields?.mrk ?? "");
  return {
    path,
    section,
    paper: JSON.stringify([
      q.sourceBundleId || "",
      q.subject,
      q.sourceBank || "",
      q.sourceFile || "",
      q.year || "",
      q.sourceSet || q.paper || "",
    ]),
    marks: /^\d+(?:\.\d+)?$/.test(mark) ? mark : "",
  };
}
export function theoryLabel(q: CbtQuestion, fallback: number): string {
  const { path } = theoryLocation(q);
  return path.length
    ? path[0] +
        path
          .slice(1)
          .map((part) => `(${part})`)
          .join("")
    : String(fallback + 1);
}
export function theoryGroupKey(q: CbtQuestion, fallback: number): string {
  const location = theoryLocation(q);
  return JSON.stringify([
    location.paper,
    location.section,
    /^\d/.test(location.path[0] || "") ? location.path[0] : (q.id ?? fallback),
  ]);
}
/** One selection unit per written parent question; CBT items remain independent. */
export function questionUnits<T extends CbtQuestion>(questions: T[]): T[][] {
  const units: T[][] = [],
    groups = new Map<string, T[]>();
  questions.forEach((q, index) => {
    if (!isWrittenQuestion(q)) {
      units.push([q]);
      return;
    }
    const key = theoryGroupKey(q, index);
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
      units.push(group);
    }
    group.push(q);
  });
  for (const unit of units)
    if (unit.length > 1)
      unit.sort(
        (a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0),
      );
  return units;
}

/** Avoid showing the same model answer twice; prefer its rich source formatting. */
export function theorySolution(q: CbtQuestion) {
  const answer = String(q.answerText || "").trim(),
    explanation = String(q.explanation || "").trim();
  const duplicate = !!answer && answer === explanation;
  return {
    text: answer || explanation,
    html:
      String(
        q.answerHtml || (!answer || duplicate ? q.explanationHtml || "" : ""),
      ) || undefined,
    explanation: duplicate || !answer ? "" : explanation,
    explanationHtml:
      duplicate || !answer
        ? undefined
        : String(q.explanationHtml || "") || undefined,
  };
}
