import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function api(fetcher: any, auth: any) {
  const api: any = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/services/api.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: api,
      require: (name: string) =>
        name === "react-native"
          ? { Platform: { OS: "ios" } }
          : name === "./auth"
            ? { supabase: { auth } }
            : (() => {
                throw Error(name);
              })(),
      process: { env: { EXPO_PUBLIC_API_URL: "https://pastq.example" } },
      __DEV__: false,
      Headers,
      AbortController,
      fetch: fetcher,
      TypeError,
      Error,
      setTimeout,
      clearTimeout,
    },
  );
  return api;
}
const session = { user: { id: "owner" }, access_token: "first" };
test("VPS request refreshes a 401 once for the same account and uses the refreshed token", async () => {
  const tokens: string[] = [];
  const client = api(
    async (url: string, init: any) => {
      assert.equal(url, "https://pastq.example/api/private");
      tokens.push(init.headers.get("Authorization"));
      return new Response(JSON.stringify({ ok: true }), {
        status: tokens.length === 1 ? 401 : 200,
      });
    },
    {
      getSession: async () => ({ data: { session } }),
      refreshSession: async () => ({
        data: { session: { ...session, access_token: "refreshed" } },
        error: null,
      }),
    },
  );
  assert.deepEqual(await client.request("/api/private", {}, true), {
    ok: true,
  });
  assert.deepEqual(tokens, ["Bearer first", "Bearer refreshed"]);
});
test("VPS retry never sends a second request after an account switch", async () => {
  let queries = 0,
    reads = 0;
  const client = api(
    async () => {
      queries++;
      return new Response("{}", { status: 401 });
    },
    {
      getSession: async () => ({
        data: {
          session:
            reads++ === 0 ? session : { ...session, user: { id: "other" } },
        },
      }),
      refreshSession: async () => {
        throw Error("must not refresh");
      },
    },
  );
  await assert.rejects(
    () => client.request("/api/private", {}, true),
    /account changed/,
  );
  assert.equal(queries, 1);
});
test("VPS timeout covers response body consumption, including a stalled download", async () => {
  const client = api(
    async (_url: string, init: any) => ({
      status: 200,
      ok: true,
      text: () =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    }),
    {},
  );
  await assert.rejects(
    () => client.requestText("/api/chunk", { timeoutMs: 15 }),
    /timed out/,
  );
});
