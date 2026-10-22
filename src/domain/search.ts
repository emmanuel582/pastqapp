import type { Question, Bundle } from "./types";
export const searchText = (value: unknown) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export const searchTerms = (query: string) =>
  searchText(query).split(" ").filter(Boolean).slice(0, 12);
export const questionText = (q: Question) =>
  [
    q.subject,
    q.topic,
    q.section,
    q.year,
    q.paper,
    q.question,
    q.questionHtml,
    ...(q.options || []),
  ]
    .map(searchText)
    .join(" ");
export function matchesQuestion(q: Question, query: string) {
  const text = questionText(q);
  return searchTerms(query).every((term) => text.includes(term));
}
export function matchesBundle(b: Bundle, query: string) {
  const text = searchText(
    [
      b.title,
      b.examType,
      b.university,
      b.manufacturer,
      ...(Array.isArray(b.subjects) ? b.subjects : []),
    ].join(" "),
  );
  return searchTerms(query).every((term) => text.includes(term));
}
export interface QuestionMatch {
  bundleId: string;
  title: string;
  question: Question;
}

export function matchesSavedQuestion(
  question: Question,
  note: string,
  query: string,
) {
  const text = questionText(question) + " " + searchText(note);
  return searchTerms(query).every((term) => text.includes(term));
}
