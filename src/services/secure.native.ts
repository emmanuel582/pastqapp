import * as SecureStore from "expo-secure-store";
const CHUNK = 1800,
  MAX_CHUNKS = 100;
const operations = new Map<string, Promise<unknown>>();
/** Serialize readers and writers so a token refresh cannot invalidate an in-flight read or sign-out. */
function serial<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (operations.get(key)?.catch(() => {}) || Promise.resolve()).then(
    work,
  );
  operations.set(key, next);
  void next
    .finally(() => {
      if (operations.get(key) === next) operations.delete(key);
    })
    .catch(() => {});
  return next;
}
async function count(key: string, generation: string) {
  const n = Number(
    await SecureStore.getItemAsync(key + "." + generation + ".count"),
  );
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_CHUNKS ? n : 0;
}
async function clean(key: string, generation: string, length?: number) {
  const n = length ?? (await count(key, generation));
  for (let i = 0; i < n; i++)
    await SecureStore.deleteItemAsync(key + "." + generation + "." + i);
  await SecureStore.deleteItemAsync(key + "." + generation + ".count");
}
export const secureStorage = {
  getItem(key: string): Promise<string | null> {
    return serial(key, async () => {
      const generation = await SecureStore.getItemAsync(key + ".head");
      if (!generation) return null;
      const n = await count(key, generation);
      if (!n) return null;
      const parts = await Promise.all(
        Array.from({ length: n }, (_, i) =>
          SecureStore.getItemAsync(key + "." + generation + "." + i),
        ),
      );
      if (parts.some((part) => part === null)) return null;
      try {
        const value: unknown = JSON.parse(parts.join(""));
        return typeof value === "string" ? value : null;
      } catch {
        return null;
      }
    });
  },
  setItem(key: string, value: string): Promise<void> {
    return serial(key, async () => {
      const encoded = JSON.stringify(value).replace(
        /[\u007f-\uffff]/g,
        (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
      );
      const n = Math.ceil(encoded.length / CHUNK);
      if (n > MAX_CHUNKS)
        throw Error("Account data is too large to save securely.");
      const old = await SecureStore.getItemAsync(key + ".head");
      const generation =
        Date.now().toString(36) + Math.random().toString(36).slice(2);
      try {
        for (let i = 0; i < n; i++)
          await SecureStore.setItemAsync(
            key + "." + generation + "." + i,
            encoded.slice(i * CHUNK, (i + 1) * CHUNK),
          );
        await SecureStore.setItemAsync(
          key + "." + generation + ".count",
          String(n),
        );
        await SecureStore.setItemAsync(key + ".head", generation);
      } catch (error) {
        await clean(key, generation, n).catch(() => {});
        throw error;
      }
      // A cleanup failure must not make a successfully published session appear to have failed.
      if (old) await clean(key, old).catch(() => {});
    });
  },
  removeItem(key: string): Promise<void> {
    return serial(key, async () => {
      const generation = await SecureStore.getItemAsync(key + ".head");
      await SecureStore.deleteItemAsync(key + ".head");
      if (generation) await clean(key, generation);
    });
  },
};
