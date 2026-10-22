import { practiceKey as sourcePracticeKey } from "../domain/contracts";
import { database, mutate } from "./records.native";
import * as records from "./records";
import type { Bundle, Question, Asset } from "../domain/types";
import type { DownloadPart } from "../services/library";
export const supportsIndex = true;
let ready: Promise<void> | undefined;
async function db() {
  const db = await database();
  await (ready ??= mutate(() =>
    db.execAsync(
      "PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS bank_questions(owner TEXT NOT NULL,bundle TEXT NOT NULL,version TEXT NOT NULL,part TEXT NOT NULL,position INTEGER NOT NULL,summary TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(owner,bundle,version,part,position)); CREATE TABLE IF NOT EXISTS bank_assets(owner TEXT NOT NULL,bundle TEXT NOT NULL,version TEXT NOT NULL,id TEXT NOT NULL,mime TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(owner,bundle,version,id)); CREATE INDEX IF NOT EXISTS bank_lookup ON bank_questions(owner,bundle,version,part);",
    ),
  ));
  return db;
}
function ref(bundle: string, version: string, part: string, position: number) {
  return [bundle, version, part, String(position)]
    .map(encodeURIComponent)
    .join("|");
}
export async function indexPart(
  owner: string,
  bundle: Bundle,
  version: string,
  part: DownloadPart,
  payload: { questions: Question[]; assets: Record<string, Asset> },
  sourceOffset = 0,
) {
  const database = await db();
  await mutate(() =>
    database.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < payload.questions.length; i++) {
        const q = payload.questions[i],
          nativeRef = ref(bundle.id, version, part.hash, i),
          practiceKey = sourcePracticeKey(bundle.id, q, sourceOffset + i);
        const summary: Question = {
          id: q.id,
          subject: q.subject,
          year: q.year,
          paper: q.paper,
          topic: q.topic,
          section: q.section,
          type: q.type,
          sourceBank: q.sourceBank,
          sourceSet: q.sourceSet,
          sourceBundleId: q.sourceBundleId,
          questionNumber: q.questionNumber,
          question: "",
          explanation: "",
          options: q.options.map(() => ""),
          correct: q.correct,
          nativeRef,
          practiceKey,
        };
        await tx.runAsync(
          "INSERT OR REPLACE INTO bank_questions(owner,bundle,version,part,position,summary,payload) VALUES(?,?,?,?,?,?,?)",
          owner,
          bundle.id,
          version,
          part.hash,
          i,
          JSON.stringify(summary),
          JSON.stringify({ ...q, practiceKey }),
        );
      }
      for (const [id, asset] of Object.entries(payload.assets || {}))
        await tx.runAsync(
          "INSERT OR REPLACE INTO bank_assets(owner,bundle,version,id,mime,data) VALUES(?,?,?,?,?,?)",
          owner,
          bundle.id,
          version,
          id,
          asset.mime,
          asset.data,
        );
    }),
  );
}
export async function commitIndex(
  owner: string,
  bundle: Bundle,
  version: string,
  selected: string[],
  count: number,
  bytes: number,
  partial: boolean,
  selection: DownloadPart[] = [],
) {
  const meta = {
    ...bundle,
    questions: [],
    updatedAt: version,
    downloadedParts: selected,
    downloadedSelection: selection,
    question_count: count,
    downloadBytes: bytes,
    partialDownload: partial,
    indexed: true,
  };
  await records.write(owner, "bundle-meta", bundle.id, meta);
  return meta;
}
export async function readIndex(owner: string, id: string) {
  const meta = await records.read<Bundle>(owner, "bundle-meta", id);
  if (!meta?.indexed) return null;
  const database = await db(),
    questions: Question[] = [];
  for (const hash of meta.downloadedParts || []) {
    const rows = await database.getAllAsync<{ summary: string }>(
      "SELECT summary FROM bank_questions WHERE owner=? AND bundle=? AND version=? AND part=? ORDER BY position",
      owner,
      id,
      meta.updatedAt!,
      hash,
    );
    for (const row of rows) questions.push(JSON.parse(row.summary));
  }
  if (questions.length !== meta.question_count)
    throw new Error(
      "This download needs repair. Open Downloads and resume it.",
    );
  return { ...meta, questions };
}
export async function resolveQuestion(owner: string, q: Question) {
  if (typeof q.nativeRef !== "string")
    return { question: q, assets: undefined };
  const [bundle, version, part, position] = q.nativeRef
      .split("|")
      .map(decodeURIComponent),
    database = await db();
  const row = await database.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM bank_questions WHERE owner=? AND bundle=? AND version=? AND part=? AND position=?",
    owner,
    bundle,
    version,
    part,
    Number(position),
  );
  if (!row)
    throw new Error(
      "This saved question is unavailable. Reconnect and download the material again.",
    );
  const question = JSON.parse(row.payload) as Question,
    hashes = [
      ...new Set(JSON.stringify(question).match(/[a-f0-9]{64}/g) || []),
    ],
    assets: Record<string, Asset> = {};
  for (const hash of hashes) {
    const asset = await database.getFirstAsync<Asset>(
      "SELECT mime,data FROM bank_assets WHERE owner=? AND bundle=? AND version=? AND id=?",
      owner,
      bundle,
      version,
      hash,
    );
    if (asset) assets[hash] = asset;
  }
  return { question: { ...question, nativeRef: q.nativeRef }, assets };
}
export async function bankBytes(owner: string) {
  const row = await (
    await db()
  ).getFirstAsync<{ bytes: number }>(
    "SELECT (SELECT COALESCE(SUM(length(payload)+length(summary)),0) FROM bank_questions WHERE owner=?)+(SELECT COALESCE(SUM(length(data)),0) FROM bank_assets WHERE owner=?) AS bytes",
    owner,
    owner,
  );
  return row?.bytes || 0;
}

export async function searchIndex(
  owner: string,
  bundle: Bundle,
  query: string,
  limit = 40,
): Promise<Question[]> {
  const meta = await records.read<Bundle>(owner, "bundle-meta", bundle.id);
  if (!meta?.indexed) return [];
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  if (!terms.length) return [];
  const expression =
    "lower(COALESCE(json_extract(payload,'$.question'),'') || ' ' || COALESCE(json_extract(payload,'$.questionHtml'),'') || ' ' || COALESCE(json_extract(payload,'$.options'),'') || ' ' || COALESCE(json_extract(payload,'$.subject'),'') || ' ' || COALESCE(json_extract(payload,'$.topic'),'') || ' ' || COALESCE(json_extract(payload,'$.section'),'') || ' ' || COALESCE(json_extract(payload,'$.year'),''))";
  const rows = await (
    await db()
  ).getAllAsync<{ payload: string; summary: string }>(
    "SELECT payload,summary FROM bank_questions WHERE owner=? AND bundle=? AND version=? AND part IN (SELECT value FROM json_each(?)) AND " +
      terms.map(() => "instr(" + expression + ",?)>0").join(" AND ") +
      " ORDER BY part,position LIMIT ?",
    owner,
    bundle.id,
    meta.updatedAt!,
    JSON.stringify(meta.downloadedParts || []),
    ...terms,
    limit,
  );
  return rows.map((row) => ({
    ...JSON.parse(row.payload),
    nativeRef: JSON.parse(row.summary).nativeRef,
  }));
}

export async function removeIndex(owner: string, bundleId: string) {
  const database = await db();
  await mutate(() =>
    database.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        "DELETE FROM bank_questions WHERE owner=? AND bundle=?",
        owner,
        bundleId,
      );
      await tx.runAsync(
        "DELETE FROM bank_assets WHERE owner=? AND bundle=?",
        owner,
        bundleId,
      );
    }),
  );
}
