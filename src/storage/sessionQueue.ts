const pending = new Map<string, Promise<unknown>>();
const key = (owner: string, id: string) => JSON.stringify([owner, id]);
export function withSession<T>(
  owner: string,
  id: string,
  work: () => Promise<T>,
): Promise<T> {
  const idKey = key(owner, id);
  const next = (pending.get(idKey) || Promise.resolve())
    .catch(() => {})
    .then(work);
  pending.set(idKey, next);
  void next
    .finally(() => {
      if (pending.get(idKey) === next) pending.delete(idKey);
    })
    .catch(() => {});
  return next;
}
export async function waitForSession(owner: string, id: string) {
  await pending.get(key(owner, id))?.catch(() => {});
}
