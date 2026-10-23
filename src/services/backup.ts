import { workingKind } from "../storage/working";
import type { WorkingPaper } from "../domain/working";
import * as Crypto from "expo-crypto";
import { resolveQuestion } from "../storage/bank";
import * as records from "../storage/records";
import { listAttempts, readAttempt, listBookmarks } from "../storage/practice";
import { attemptSummary } from "../domain/attempt";
import { validateBackup, type Backup } from "../domain/backup";
export async function exportBackup(owner: string) {
  const headers = await listAttempts(owner),
    attempts = [];
  for (const header of headers)
    attempts.push(await readAttempt(owner, header.id));
  const papers = [];
  const workingPapers = [];
  for (const attempt of attempts) {
    for (
      let questionIndex = 0;
      questionIndex < attempt.questions.length;
      questionIndex++
    ) {
      const paper = await records.read<WorkingPaper>(
        owner,
        workingKind(attempt.id),
        String(questionIndex),
      );
      if (paper)
        workingPapers.push({ attemptId: attempt.id, questionIndex, paper });
    }
    const questions = [],
      assets = { ...attempt.assets };
    for (const source of attempt.questions) {
      const value = await resolveQuestion(owner, source);
      const { nativeRef: _ref, ...q } = value.question;
      questions.push(q);
      Object.assign(assets, value.assets);
    }
    papers.push({
      id: attempt.id,
      paper: {
        title: attempt.title,
        source: {
          bundleId: attempt.bundleId,
          version: attempt.version || null,
        },
        questions,
        assets,
      },
    });
  }
  const iso = (n: number) => new Date(n).toISOString();
  return JSON.stringify({
    format: "pastq-study-backup",
    version: 1,
    owner,
    createdAt: iso(Date.now()),
    attempts: attempts.map((a) => ({
      id: a.id,
      owner,
      writer: "pastq-native",
      title: a.title,
      source: { bundleId: a.bundleId, version: a.version || null },
      status: a.status,
      startedAt: iso(a.startedAt),
      updatedAt: iso(a.completedAt || Date.now()),
      completedAt: a.completedAt ? iso(a.completedAt) : undefined,
      deadline: a.deadline,
      duration: a.duration,
      practice: a.mode === "practice",
      questionCount: a.questions.length,
      answers: a.answers,
      writtenAnswers: a.written,
      flagged: a.flagged,
      currentQ: a.current,
      score: attemptSummary(a).correct,
      gradedTotal: attemptSummary(a).graded,
      timeTaken: Math.min(
        a.duration,
        Math.round(((a.completedAt || Date.now()) - a.startedAt) / 1000),
      ),
    })),
    papers,
    workingPapers,
    bookmarks: await Promise.all(
      (await listBookmarks(owner)).map(async (mark) => ({
        ...mark,
        key: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          JSON.stringify([
            mark.bundleId,
            mark.question.practiceKey || [
              mark.question.subject,
              mark.question.year,
              mark.question.question,
              mark.question.options,
            ],
          ]),
        ),
        source: { bundleId: mark.bundleId, version: null },
        createdAt: iso(mark.createdAt),
        answer: null,
      })),
    ),
    history: attempts
      .filter((a) => a.status === "completed")
      .map((a) => ({
        id: a.id,
        title: a.title,
        completed_at: iso(a.completedAt!),
        score: attemptSummary(a).correct,
        total_questions: a.questions.length,
        graded_total: attemptSummary(a).graded,
        source_bundle_id: a.bundleId,
        duration_seconds: Math.min(
          a.duration,
          Math.round((a.completedAt! - a.startedAt) / 1000),
        ),
      })),
  });
}
export async function importBackup(owner: string, text: string) {
  const value = validateBackup(JSON.parse(text), owner),
    rows: records.RecordChange[] = [];
  const imported = new Set<string>();
  for (const a of value.attempts) {
    if (await records.read(owner, "attempt", a.id)) continue;
    imported.add(a.id);
    rows.push({ kind: "attempt-deleted", id: a.id, remove: true });
    const { questions, assets, ...header } = a;
    if (a.status === "completed")
      rows.push({ kind: "history-outbox", id: a.id, value: { id: a.id } });
    rows.push(
      {
        kind: "attempt",
        id: a.id,
        value: {
          ...header,
          questionCount: questions.length,
          summary: attemptSummary(a),
        },
      },
      { kind: "attempt-paper", id: a.id, value: { questions, assets } },
    );
  }
  for (const b of value.bookmarks)
    if (!(await records.read(owner, "bookmark", b.id)))
      rows.push({ kind: "bookmark", id: b.id, value: b });
  for (const item of value.workingPapers)
    if (imported.has(item.attemptId))
      rows.push({
        kind: workingKind(item.attemptId),
        id: String(item.questionIndex),
        value: item.paper,
      });
  await records.commit(owner, rows);
  return { sessions: value.attempts.length, bookmarks: value.bookmarks.length };
}
