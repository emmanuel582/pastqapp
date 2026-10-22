import type { Attempt, Bookmark, Question } from "./types";
import { attemptSummary, bookmarkIdentity } from "./attempt";
export interface Backup {
  format: "pastq-native-study-backup";
  version: 1;
  owner: string;
  createdAt: string;
  attempts: Attempt[];
  bookmarks: Bookmark[];
}
function validQuestion(q: unknown): q is Question {
  if (!q || typeof q !== "object") return false;
  const value = q as Question;
  return (
    typeof value.subject === "string" &&
    typeof value.question === "string" &&
    Array.isArray(value.options) &&
    value.options.every((o) => typeof o === "string")
  );
}
export function validateBackup(raw: unknown, owner: string): Backup {
  if (!raw || typeof raw !== "object") throw new Error("Invalid backup.");
  const value = raw as Record<string, any>;
  if (
    value.owner !== owner ||
    !owner ||
    value.version !== 1 ||
    !["pastq-native-study-backup", "pastq-study-backup"].includes(value.format)
  )
    throw new Error(
      "This backup belongs to another account or uses an unsupported format.",
    );
  let attempts: Attempt[] = value.attempts,
    bookmarks: Bookmark[] = value.bookmarks;
  if (value.format === "pastq-study-backup") {
    if (
      !Array.isArray(value.papers) ||
      !Array.isArray(value.attempts) ||
      !Array.isArray(value.bookmarks)
    )
      throw new Error("Invalid backup.");
    attempts = value.attempts.map((a: any) => {
      const paper = value.papers.find((p: any) => p.id === a.id)?.paper;
      if (!paper) throw new Error("The backup contains an incomplete session.");
      return {
        ...a,
        bundleId: a.source?.bundleId,
        version: a.source?.version,
        questions: paper.questions,
        assets: paper.assets,
        written: a.writtenAnswers,
        current: a.currentQ,
        startedAt: Date.parse(a.startedAt),
        completedAt: a.completedAt ? Date.parse(a.completedAt) : undefined,
        mode: a.practice ? "practice" : "full",
      };
    });
    bookmarks = value.bookmarks.map((b: any) => ({
      ...b,
      id: bookmarkIdentity(b.source?.bundleId, b.question),
      bundleId: b.source?.bundleId,
      note: b.note || "",
      createdAt: Date.parse(b.createdAt),
    }));
  }
  if (
    !Array.isArray(attempts) ||
    !Array.isArray(bookmarks) ||
    attempts.length > 10000 ||
    bookmarks.length > 20000
  )
    throw new Error("Invalid backup.");
  const ids = new Set<string>();
  for (const a of attempts) {
    if (
      !a ||
      a.owner !== owner ||
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      !["active", "completed"].includes(a.status) ||
      !Number.isFinite(a.startedAt) ||
      !Number.isFinite(a.deadline) ||
      !Number.isFinite(a.duration) ||
      a.duration <= 0 ||
      typeof a.bundleId !== "string" ||
      typeof a.title !== "string" ||
      !["practice", "full"].includes(a.mode) ||
      !Array.isArray(a.questions) ||
      !a.questions.length ||
      a.questions.some((q) => !validQuestion(q)) ||
      !Array.isArray(a.answers) ||
      a.answers.length !== a.questions.length ||
      a.answers.some(
        (n, i) =>
          n !== null &&
          (!Number.isInteger(n) ||
            n < 0 ||
            (n >= a.questions[i].options.length &&
              a.questions[i].type !== "theory")),
      ) ||
      !Array.isArray(a.written) ||
      a.written.length !== a.questions.length ||
      a.written.some((s) => typeof s !== "string") ||
      !Array.isArray(a.flagged) ||
      a.flagged.length !== a.questions.length ||
      a.flagged.some((b) => typeof b !== "boolean") ||
      !Number.isInteger(a.current) ||
      a.current < 0 ||
      a.current >= a.questions.length ||
      (a.status === "completed" && !Number.isFinite(a.completedAt))
    )
      throw new Error("The backup contains an incomplete session.");
    ids.add(a.id);
  }
  for (const b of bookmarks)
    if (
      !b ||
      b.owner !== owner ||
      typeof b.id !== "string" ||
      typeof b.bundleId !== "string" ||
      !validQuestion(b.question) ||
      typeof b.note !== "string"
    )
      throw new Error("The backup contains an invalid saved question.");
  return {
    format: "pastq-native-study-backup",
    version: 1,
    owner,
    createdAt: value.createdAt,
    attempts,
    bookmarks,
  };
}
