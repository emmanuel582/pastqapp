import test from "node:test";
import assert from "node:assert/strict";
import {
  MOBILE_AUTH_CALLBACK,
  isAuthCallback,
  validateOAuthStart,
} from "../src/domain/authRedirect";
test("installed app callback stays exact and never includes a development host", () => {
  assert.equal(MOBILE_AUTH_CALLBACK, "pastq://auth/callback");
  assert.ok(
    isAuthCallback(MOBILE_AUTH_CALLBACK + "?code=one", MOBILE_AUTH_CALLBACK),
  );
  for (const uri of [
    "https://sigmawealthsolution.com",
    "https://pastqfrontend.vercel.app",
    "pastq://auth/callback/evil",
    "pastq://auth:3000/callback",
    "pastq://user:password@auth/callback",
    "not a URI",
  ])
    assert.equal(isAuthCallback(uri, MOBILE_AUTH_CALLBACK), false);
});
test("OAuth start must carry the exact app redirect and trusted auth host", () => {
  const host = "https://auth.example.test";
  const url = new URL(host + "/auth/v1/authorize?provider=google");
  url.searchParams.set("redirect_to", MOBILE_AUTH_CALLBACK);
  assert.doesNotThrow(() =>
    validateOAuthStart(url.href, host, MOBILE_AUTH_CALLBACK),
  );
  url.searchParams.set("redirect_to", "https://website.example.test");
  assert.throws(() => validateOAuthStart(url.href, host, MOBILE_AUTH_CALLBACK));
  url.searchParams.set("redirect_to", MOBILE_AUTH_CALLBACK);
  assert.throws(() =>
    validateOAuthStart(
      url.href,
      "https://other.example.test",
      MOBILE_AUTH_CALLBACK,
    ),
  );
});
