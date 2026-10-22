import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { secureStorage } from "./secure";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: secureStorage,
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
export async function handleAuthUrl(url: string) {
  const client = requireAuth(),
    parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  const hash = new URLSearchParams(parsed.hash.slice(1));
  const access_token = hash.get("access_token"),
    refresh_token = hash.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await client.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
  }
}
export async function signInGoogle() {
  const redirectTo = Linking.createURL("auth/callback");
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
