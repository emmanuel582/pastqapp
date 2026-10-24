import { Platform } from "react-native";
import { supabase } from "./auth";
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/$/, "");
export type ApiOptions = RequestInit & { timeoutMs?: number };
export function apiUrl(path: string) {
  if (!API_BASE)
    throw new Error(
      "Connect to your focalPoint API to continue. Set EXPO_PUBLIC_API_URL in the mobile project.",
    );
  const base =
    __DEV__ && Platform.OS === "web"
      ? globalThis.location.origin + "/__pastq_api"
      : API_BASE;
  return base + (path.startsWith("/") ? path : "/" + path);
}
async function consume<T>(
  path: string,
  options: ApiOptions,
  authenticated: boolean,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const { timeoutMs = 30000, ...init } = options,
    headers = new Headers(init.headers);
  const original = authenticated
    ? (await supabase?.auth.getSession())?.data.session
    : null;
  if (authenticated && !original) throw new Error("Sign in to continue.");
  if (original) headers.set("Authorization", "Bearer " + original.access_token);
  const controller = new AbortController(),
    external = init.signal,
    abort = () => controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  if (external?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    let res = await fetch(apiUrl(path), {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (res.status === 401 && authenticated && supabase) {
      const current = (await supabase.auth.getSession()).data.session;
      if (current?.user.id !== original!.user.id)
        throw new Error("Your account changed. Sign in again.");
      const refreshed = await supabase.auth.refreshSession();
      if (
        refreshed.error ||
        !refreshed.data.session ||
        refreshed.data.session.user.id !== original!.user.id
      )
        throw new Error("Your session expired. Sign in again.");
      headers.set(
        "Authorization",
        "Bearer " + refreshed.data.session.access_token,
      );
      res = await fetch(apiUrl(path), {
        ...init,
        headers,
        signal: controller.signal,
      });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        typeof body?.error === "string"
          ? body.error
          : body?.error?.message ||
              "Could not finish (" + res.status + "). Try again.",
      );
    }
    const value = await read(res);
    if (
      authenticated &&
      (await supabase?.auth.getSession())?.data.session?.user.id !==
        original!.user.id
    )
      throw new Error("Your account changed. Sign in again.");
    return value;
  } catch (error) {
    if (controller.signal.aborted && !external?.aborted)
      throw new Error(
        "The request timed out. Check your connection and retry. Your saved work stays on this device.",
      );
    if (error instanceof TypeError)
      throw new Error("Couldn’t connect. Check your connection and try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}
export const response = (
  path: string,
  options: ApiOptions = {},
  authenticated = false,
) => consume(path, options, authenticated, async (res) => res);
export const request = <T>(
  path: string,
  options: ApiOptions = {},
  authenticated = false,
): Promise<T> =>
  consume(path, options, authenticated, async (res) =>
    res.status === 204 ? (undefined as T) : res.json(),
  );
export const requestText = (
  path: string,
  options: ApiOptions = {},
  authenticated = false,
) => consume(path, options, authenticated, (res) => res.text());
export const requestBlob = (
  path: string,
  options: ApiOptions = {},
  authenticated = false,
) => consume(path, options, authenticated, (res) => res.blob());
export const json = (method: string, body: unknown): ApiOptions => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
