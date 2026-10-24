/** Stable installed-app callback. Keep the legacy registered scheme for existing users. */
export const MOBILE_AUTH_CALLBACK = "pastq://auth/callback";
export function isAuthCallback(value: string, expected: string): boolean {
  try {
    const url = new URL(value),
      target = new URL(expected);
    return (
      !url.username &&
      !url.password &&
      url.protocol === target.protocol &&
      url.host === target.host &&
      url.pathname === target.pathname
    );
  } catch {
    return false;
  }
}
export function validateOAuthStart(
  value: string,
  authOrigin: string,
  callback: string,
) {
  const url = new URL(value);
  if (
    url.origin !== new URL(authOrigin).origin ||
    url.pathname !== "/auth/v1/authorize" ||
    url.searchParams.get("provider") !== "google" ||
    url.searchParams.get("redirect_to") !== callback
  )
    throw Error(
      "Google sign-in could not start with the app callback. Try again.",
    );
}
