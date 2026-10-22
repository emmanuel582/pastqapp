import { resolveQuestion } from "./bank";
import * as records from "./records";
import { attemptSummary, bookmarkIdentity } from "../domain/attempt";
import type { Attempt, Bookmark, Question, Bundle } from "../domain/types";
export type AttemptHeader = Omit<Attempt, "questions" | "assets"> & {
  questionCount: number;
  summary: ReturnType<typeof attemptSummary>;
};
const queues = new Map<string, Promise<void>>();
export function saveAttempt(attempt: Attempt, newPaper = false) {
  const key = attempt.owner + ":" + attempt.id;
  const next = (queues.get(key) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      let { questions, assets, ...metadata } = attempt;
      if (newPaper) {
        const selectedAssets: NonNullable<Attempt["assets"]> = {};
        const hydrated: Question[] = [];
        for (const source of questions) {
          const value = await resolveQuestion(attempt.owner, source);
          const { nativeRef: _nativeRef, ...question } = value.question;
          hydrated.push(question as Question);
          Object.assign(selectedAssets, value.assets);
          const refs = JSON.stringify(question).match(/[a-f0-9]{64}/g) || [];
          for (const id of refs)
            if (assets?.[id]) selectedAssets[id] = assets[id];
        }
        questions = hydrated;
        assets = selectedAssets;
      }
      const header = {
        ...metadata,
        questionCount: questions.length,
        summary: attemptSummary(attempt),
      };
      const rows: { kind: string; id: string; value: unknown }[] = [
        { kind: "attempt", id: attempt.id, value: header },
      ];
      if (newPaper)
        rows.push({
          kind: "attempt-paper",
          id: attempt.id,
          value: { questions, assets },
        });
      if (attempt.status === "completed")
        rows.push({ kind: "history-outbox", id: attempt.id, value: header });
      await records.restore(attempt.owner, rows);
    });
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => {});
  return next;
}
export const listAttempts = (owner: string) =>
  records.list<AttemptHeader>(owner, "attempt");
export async function readAttempt(owner: string, id: string): Promise<Attempt> {
  await queues.get(owner + ":" + id);
  const header = await records.read<AttemptHeader>(owner, "attempt", id);
  const paper = await records.read<Pick<Attempt, "questions" | "assets">>(
    owner,
    "attempt-paper",
    id,
  );
  if (!header || !paper) throw new Error("This saved exam could not open.");
  return { ...header, ...paper };
}
export async function discardAttempt(owner: string, id: string) {
  const attempt = await records.read<AttemptHeader>(owner, "attempt", id);
  if (attempt?.status !== "active")
    throw new Error("Only unfinished exams can be discarded.");
  await records.remove(owner, "attempt", id);
  await records.remove(owner, "attempt-paper", id);
}
export const listBookmarks = (owner: string) =>
  records.list<Bookmark>(owner, "bookmark");
export async function toggleBookmark(
  owner: string,
  bundle: Pick<Bundle, "id" | "title" | "assets">,
  question: Question,
) {
  const id = bookmarkIdentity(bundle.id, question);
  if (await records.read(owner, "bookmark", id)) {
    await records.remove(owner, "bookmark", id);
    return false;
  }
  const refs: string[] = JSON.stringify(question).match(/[a-f0-9]{64}/g) || [];
  const assets = Object.fromEntries(
    Object.entries(bundle.assets || {}).filter(([key]) => refs.includes(key)),
  );
  await records.write(owner, "bookmark", id, {
    id,
    owner,
    bundleId: bundle.id,
    title: bundle.title,
    question,
    assets,
    note: "",
    createdAt: Date.now(),
  } satisfies Bookmark);
  return true;
}
