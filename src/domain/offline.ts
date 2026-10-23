import type { Session } from "@supabase/supabase-js";
/** Restore this device's prior sign-in for local study; server calls still use Supabase's authenticated client. */
export function cachedStudySession(text: string | null): Session | null {
  try {
    const value = JSON.parse(text || "null");
    return value &&
      typeof value.access_token === "string" &&
      typeof value.refresh_token === "string" &&
      typeof value.user?.id === "string" &&
      value.user.id.length > 0 &&
      Number.isFinite(value.expires_at)
      ? (value as Session)
      : null;
  } catch {
    return null;
  }
}
