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
export async function remove(
  owner: string,
  kind: string,
  id: string,
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").delete(key(owner, kind, id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function restore(
  owner: string,
  rows: { kind: string; id: string; value: unknown }[],
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    for (const row of rows)
      tx.objectStore("records").put({
        key: key(owner, row.kind, row.id),
        owner,
        ...row,
        updated: Date.now(),
      });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
