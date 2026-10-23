// Browser preview adapter. Device builds resolve records.native.ts (SQLite).
let pending: Promise<IDBDatabase> | undefined;
function database() {
  return (pending ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("pastq-native-preview", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("records", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
const key = (owner: string, kind: string, id: string) =>
  JSON.stringify([owner, kind, id]);
export async function read<T>(
  owner: string,
  kind: string,
  id: string,
): Promise<T | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("records")
      .objectStore("records")
      .get(key(owner, kind, id));
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}
export async function list<T>(owner: string, kind: string): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").getAll();
    request.onsuccess = () =>
      resolve(
        request.result
          .filter((row) => row.owner === owner && row.kind === kind)
          .sort((a, b) => b.updated - a.updated)
          .map((row) => row.value),
      );
    request.onerror = () => reject(request.error);
  });
}
export async function write(
  owner: string,
  kind: string,
  id: string,
  value: unknown,
) {
  await restore(owner, [{ kind, id, value }]);
}
export type RecordChange =
  | { kind: string; id: string; value: unknown }
  | { kind: string; id?: string; remove: true };
export async function commit(
  owner: string,
  changes: RecordChange[],
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    for (const row of changes) {
      if ("remove" in row) {
        if (row.id !== undefined) store.delete(key(owner, row.kind, row.id));
        else {
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            if (
              current.value.owner === owner &&
              current.value.kind === row.kind
            )
              current.delete();
            current.continue();
          };
        }
      } else
        store.put({
          key: key(owner, row.kind, row.id),
          owner,
          ...row,
          updated: Date.now(),
        });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || Error("Your changes could not be saved."));
  });
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
): Promise<void> {
  await commit(owner, rows);
}
