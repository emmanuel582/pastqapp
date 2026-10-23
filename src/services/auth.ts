import { cachedStudySession } from "../domain/offline";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { secureStorage } from "./secure";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const authStorageKey = url
  ? "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token"
  : "pastq-auth-token";
export async function readCachedStudySession() {
  return cachedStudySession(await secureStorage.getItem(authStorageKey));
}
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: secureStorage,
          storageKey: authStorageKey,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;
export function requireAuth() {
  if (!supabase)
    throw new Error(
      "Connect this app to your PastQ account service. See the project .env.example.",
    );
  return supabase;
}
export function authCallbackUrl() {
  return Platform.OS === "web"
    ? Linking.createURL("auth/callback")
    : Linking.createURL("auth/callback", { scheme: "pastq" });
}
if (Platform.OS === "web") WebBrowser.maybeCompleteAuthSession();
const exchanges = new Map<string, Promise<void>>();
export async function handleAuthUrl(url: string): Promise<void> {
  const parsed = new URL(url),
    expected = new URL(authCallbackUrl());
  if (
    parsed.protocol !== expected.protocol ||
    parsed.host !== expected.host ||
    parsed.pathname !== expected.pathname
  )
    return;
  const hash = new URLSearchParams(parsed.hash.slice(1));
  if (parsed.searchParams.get("error") || hash.get("error"))
    throw Error("Sign-in did not finish. Please try again.");
  const code = parsed.searchParams.get("code");
  if (code) {
    let pending = exchanges.get(code);
    if (!pending) {
      pending = (async () => {
        const { error } = await requireAuth().auth.exchangeCodeForSession(code);
        if (error) throw error;
      })();
      exchanges.set(code, pending);
      if (exchanges.size > 8) exchanges.delete(exchanges.keys().next().value!);
      void pending.catch(() => {
        if (exchanges.get(code) === pending) exchanges.delete(code);
      });
    }
    await pending;
    return;
  }
  const access_token = hash.get("access_token"),
    refresh_token = hash.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await requireAuth().auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
  }
}
export async function signInGoogle() {
  const redirectTo = authCallbackUrl();
  const client = requireAuth();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: "offline", prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign in could not start.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success") await handleAuthUrl(result.url);
}
export function manageAuthLifecycle() {
  if (!supabase) return () => {};
  const client = supabase;
  const update = (state: string) =>
    state === "active"
      ? client.auth.startAutoRefresh()
      : client.auth.stopAutoRefresh();
  update(AppState.currentState || "active");
  const subscription = AppState.addEventListener("change", update);
  return () => {
    subscription.remove();
    client.auth.stopAutoRefresh();
  };
}
