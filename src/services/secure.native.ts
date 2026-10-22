import * as SecureStore from "expo-secure-store";
// Supabase sessions can exceed SecureStore's per-value limit. Chunk ASCII JSON.
const CHUNK = 1800;
export const secureStorage = {
  async getItem(key: string) {
    const generation = await SecureStore.getItemAsync(key + ".head");
    if (!generation) return null;
    const count = Number(
      await SecureStore.getItemAsync(key + "." + generation + ".count"),
    );
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(key + "." + generation + "." + i),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    const old = await SecureStore.getItemAsync(key + ".head");
    const generation =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    const encoded = JSON.stringify(value).replace(
      /[\u007f-\uffff]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
    const count = Math.ceil(encoded.length / CHUNK);
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        key + "." + generation + "." + i,
        encoded.slice(i * CHUNK, (i + 1) * CHUNK),
      );
    await SecureStore.setItemAsync(
      key + "." + generation + ".count",
      String(count),
    );
    await SecureStore.setItemAsync(key + ".head", generation);
    if (old) {
      const n = Number(
        await SecureStore.getItemAsync(key + "." + old + ".count"),
      );
      for (let i = 0; i < n; i++)
        await SecureStore.deleteItemAsync(key + "." + old + "." + i);
      await SecureStore.deleteItemAsync(key + "." + old + ".count");
    }
  },
  async removeItem(key: string) {
    const generation = await SecureStore.getItemAsync(key + ".head");
    await SecureStore.deleteItemAsync(key + ".head");
    if (generation) {
      const count = Number(
        await SecureStore.getItemAsync(key + "." + generation + ".count"),
      );
      for (let i = 0; i < count; i++)
        await SecureStore.deleteItemAsync(key + "." + generation + "." + i);
      await SecureStore.deleteItemAsync(key + "." + generation + ".count");
    }
  },
};
const get = secureStorage.getItem;
secureStorage.getItem = async (key) => {
  const value = await get(key);
  return value ? (JSON.parse(value) as string) : null;
};
