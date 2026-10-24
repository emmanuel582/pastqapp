import { withSession, waitForSession } from "./sessionQueue";
import { workingKind } from "./working";
import { resolveQuestion } from "./bank";
import * as records from "./records";
import { progressSession, type ProgressSession } from "../domain/topicProgress";
import { attemptSummary, bookmarkIdentity } from "../domain/attempt";
import type { Attempt, Bookmark, Question, Bundle } from "../domain/types";
export type AttemptHeader = Omit<Attempt, "questions" | "assets"> & {
  questionCount: number;
  topicProgress?: ProgressSession;
  summary: ReturnType<typeof attemptSummary>;
};
export function saveAttempt(attempt: Attempt, newPaper = false) {
  return withSession(attempt.owner, attempt.id, async () => {
    if (await records.read(attempt.owner, "attempt-deleted", attempt.id))
      throw Error("This session was deleted.");
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
      ...(attempt.status === "completed"
        ? { topicProgress: progressSession(attempt) ?? undefined }
        : {}),
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
}
export const listAttempts = (owner: string) =>
  records.list<AttemptHeader>(owner, "attempt");
export async function readAttempt(owner: string, id: string): Promise<Attempt> {
  await waitForSession(owner, id);
  if (await records.read(owner, "attempt-deleted", id))
    throw Error("This session was deleted.");
  const header = await records.read<AttemptHeader>(owner, "attempt", id);
  const paper = await records.read<Pick<Attempt, "questions" | "assets">>(
    owner,
    "attempt-paper",
    id,
  );
  if (!header || !paper) throw new Error("This saved exam could not open.");
  return { ...header, ...paper };
}
export const deletedAttemptIds = async (owner: string) =>
  new Set(
    (await records.list<{ id: string }>(owner, "attempt-deleted")).map(
      (row) => row.id,
    ),
  );
export function deleteAttempt(owner: string, id: string, allowActive = false) {
  return withSession(owner, id, async () => {
    const attempt = await records.read<AttemptHeader>(owner, "attempt", id);
    if (allowActive && attempt?.status !== "active")
      throw Error("Only unfinished exams can be discarded.");
    if (attempt?.status === "active" && !allowActive)
      throw Error("Finish or discard this exam first.");
    await records.commit(owner, [
      { kind: "attempt-deleted", id, value: { id, deletedAt: Date.now() } },
      ...["attempt", "attempt-paper", "history-outbox", "cohort-outbox"].map(
        (kind) => ({ kind, id, remove: true as const }),
      ),
      { kind: workingKind(id), remove: true },
    ]);
  });
}
export function discardAttempt(owner: string, id: string) {
  return deleteAttempt(owner, id, true);
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
