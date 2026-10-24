import * as authRedirect from "../src/domain/authRedirect";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture() {
  let exchanges = 0,
    fail = false,
    oauth: any,
    returnUrl: string | undefined;
  const api: any = {};
  const auth = {
    exchangeCodeForSession: async () => {
      exchanges++;
      return { error: fail ? Error("retry") : null };
    },
    setSession: async () => ({ error: null }),
    signInWithOAuth: async (input: any) => {
      oauth = input;
      return {
        data: {
          url:
            "https://example.supabase.co/auth/v1/authorize?provider=google&redirect_to=" +
            encodeURIComponent(input.options.redirectTo),
        },
        error: null,
      };
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/services/auth.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: api,
      URL,
      URLSearchParams,
      Map,
      Promise,
      Error,
      process: {
        env: {
          EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public",
        },
      },
      require: (p: string) => {
        if (p === "../domain/authRedirect") return authRedirect;
        if (p === "../domain/offline")
          return { cachedStudySession: () => null };
        if (p === "react-native-url-polyfill/auto") return {};
        if (p === "@supabase/supabase-js")
          return { createClient: () => ({ auth }) };
        if (p === "react-native")
          return {
            Platform: { OS: "ios" },
            AppState: { currentState: "active" },
          };
        if (p === "expo-linking")
          return {
            createURL: (path: string, options: any) => {
              throw Error(
                "Native OAuth must not derive a callback from the development host",
              );
            },
          };
        if (p === "expo-web-browser")
          return {
            openAuthSessionAsync: async (_url: string, callback: string) => {
              returnUrl = callback;
              return { type: "success", url: callback + "?code=from-google" };
            },
          };
        if (p === "./secure") return { secureStorage: {} };
        throw Error(p);
      },
    },
  );
  return {
    api,
    get exchanges() {
      return exchanges;
    },
    get oauth() {
      return oauth;
    },
    get returnUrl() {
      return returnUrl;
    },
    fail(v: boolean) {
      fail = v;
    },
  };
}
test("native Google flow requests the app callback and exchanges it once even when the deep-link listener also receives it", async () => {
  const f = fixture();
  await f.api.signInGoogle();
  assert.equal(f.oauth.options.redirectTo, "pastq://auth/callback");
  assert.equal(f.returnUrl, "pastq://auth/callback");
  await Promise.all([
    f.api.handleAuthUrl("pastq://auth/callback?code=from-google"),
    f.api.handleAuthUrl("pastq://auth/callback?code=from-google"),
  ]);
  assert.equal(f.exchanges, 1);
});
test("auth callbacks ignore unrelated routes and failed exchanges can retry", async () => {
  const f = fixture();
  await f.api.handleAuthUrl(
    "https://another-site.test/auth/callback?code=wrong",
  );
  await f.api.handleAuthUrl("pastq://other/path?code=wrong");
  assert.equal(f.exchanges, 0);
  f.fail(true);
  await assert.rejects(f.api.handleAuthUrl("pastq://auth/callback?code=retry"));
  f.fail(false);
  await f.api.handleAuthUrl("pastq://auth/callback?code=retry");
  assert.equal(f.exchanges, 2);
  await assert.rejects(
    f.api.handleAuthUrl("pastq://auth/callback#error=access_denied"),
    /Sign-in did not finish/,
  );
});
