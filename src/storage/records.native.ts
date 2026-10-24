import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
let pending: Promise<SQLiteDatabase> | undefined;
let writes: Promise<unknown> = Promise.resolve();
/** Serialize all SQLite writers, including exclusive transactions' separate connections. */
export function mutate<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.catch(() => {}).then(work);
  writes = next;
  return next;
}
export function database() {
  return (pending ??= openDatabaseAsync("pastq-native.db")
    .then(async (db) => {
      await db.execAsync(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS records (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(owner,kind,id)); CREATE INDEX IF NOT EXISTS records_lookup ON records(owner,kind,updated DESC);",
      );
      return db;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
export async function read<T>(
  owner: string,
  kind: string,
  id: string,
): Promise<T | null> {
  const row = await (
    await database()
  ).getFirstAsync<{ value: string }>(
    "SELECT value FROM records WHERE owner=? AND kind=? AND id=?",
    owner,
    kind,
    id,
  );
  return row ? (JSON.parse(row.value) as T) : null;
}
export async function list<T>(owner: string, kind: string): Promise<T[]> {
  const rows = await (
    await database()
  ).getAllAsync<{ value: string }>(
    "SELECT value FROM records WHERE owner=? AND kind=? ORDER BY updated DESC",
    owner,
    kind,
  );
  return rows.map((row) => JSON.parse(row.value) as T);
}
export async function write(
  owner: string,
  kind: string,
  id: string,
  value: unknown,
): Promise<void> {
  await mutate(async () =>
    (await database()).runAsync(
      "INSERT INTO records(owner,kind,id,value,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET value=excluded.value,updated=excluded.updated",
      owner,
      kind,
      id,
      JSON.stringify(value),
      Date.now(),
    ),
  );
}
export type RecordChange =
  | { kind: string; id: string; value: unknown }
  | { kind: string; id?: string; remove: true };
export async function commit(
  owner: string,
  changes: RecordChange[],
): Promise<void> {
  const db = await database();
  await mutate(() =>
    db.withExclusiveTransactionAsync(async (tx) => {
      for (const row of changes) {
        if ("remove" in row) {
          if (row.id === undefined)
            await tx.runAsync(
              "DELETE FROM records WHERE owner=? AND kind=?",
              owner,
              row.kind,
            );
          else
            await tx.runAsync(
              "DELETE FROM records WHERE owner=? AND kind=? AND id=?",
              owner,
              row.kind,
              row.id,
            );
        } else
          await tx.runAsync(
            "INSERT INTO records(owner,kind,id,value,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET value=excluded.value,updated=excluded.updated",
            owner,
            row.kind,
            row.id,
            JSON.stringify(row.value),
            Date.now(),
          );
      }
    }),
  );
}
export async function remove(
  owner: string,
  kind: string,
  id: string,
): Promise<void> {
  await commit(owner, [{ kind, id, remove: true }]);
}
export async function restore(
  owner: string,
  rows: { kind: string; id: string; value: unknown }[],
) {
  await commit(owner, rows);
}

/** Atomically acknowledge one version without overwriting a newer draft. */
export async function compareAndSwap(
  owner: string,
  kind: string,
  id: string,
  expected: unknown,
  next: unknown | null,
): Promise<boolean> {
  return mutate(async () => {
    const db = await database();
    const result =
      next === null
        ? await db.runAsync(
            "DELETE FROM records WHERE owner=? AND kind=? AND id=? AND value=?",
            owner,
            kind,
            id,
            JSON.stringify(expected),
          )
        : await db.runAsync(
            "UPDATE records SET value=?, updated=? WHERE owner=? AND kind=? AND id=? AND value=?",
            JSON.stringify(next),
            Date.now(),
            owner,
            kind,
            id,
            JSON.stringify(expected),
          );
    return result.changes === 1;
  });
}
