import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { trustedApiUrl } from "../src/domain/contracts";
function fixture() {
  let owner = "alice";
  const fetched: string[] = [];
  const data = "data:image/png;base64," + "a".repeat(4096);
  const exports: any = {};
  class Reader {
    result: string | null = null;
    onload?: () => void;
    readAsDataURL() {
      this.result = data;
      this.onload?.();
    }
  }
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/privateMedia.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      URL,
      FileReader: Reader,
      require: (p: string) => {
        if (p === "expo-crypto")
          return {
            CryptoDigestAlgorithm: { SHA256: "sha256" },
            digestStringAsync: async (_a: string, s: string) =>
              createHash("sha256").update(s).digest("hex"),
          };
        if (p === "./api")
          return {
            API_BASE: "https://focalpoint.example",
            requestBlob: async (path: string, opts: any) => {
              assert.equal(opts.owner, "alice");
              fetched.push(path);
              return { type: "image/png", size: 3072 };
            },
          };
        if (p === "./auth")
          return {
            supabase: {
              auth: {
                getSession: async () => ({
                  data: { session: { user: { id: owner } } },
                }),
              },
            },
          };
        if (p === "../domain/contracts") return { trustedApiUrl };
        throw Error(p);
      },
    },
  );
  return { api: exports, fetched, data, owner: (v: string) => (owner = v) };
}
const source = () => ({
  id: "material",
  title: "Notes",
  sourceSessionId: "upload",
  ownerId: "alice",
  questions: [
    {
      id: 1,
      subject: "Biology",
      question: "Identify the cell",
      options: ["A", "B"],
      correct: 0,
      figures: [{ url: "/api/library/figures/diagram" }],
      questionHtml: '<img src="/api/library/figures/diagram">',
    },
    {
      id: 2,
      subject: "Biology",
      question: "Explain the same diagram",
      options: [],
      type: "theory",
      figures: [{ url: "/api/library/figures/copy" }],
    },
  ],
});
test("private diagrams are stored once and reused across figures and rich question text", async () => {
  const f = fixture(),
    original = source(),
    before = JSON.stringify(original);
  const result = await f.api.preparePrivateMedia("alice", original);
  assert.equal(f.fetched.length, 2);
  assert.equal(Object.keys(result.assets).length, 1);
  const reference = result.questions[0].figures[0].url;
  assert.match(reference, /^pastq-asset:[a-f0-9]{64}$/);
  assert.equal(result.questions[1].figures[0].url, reference);
  assert.ok(result.questions[0].questionHtml.includes(reference));
  assert.equal(JSON.stringify(original), before);
  const old = JSON.stringify(original)
    .replaceAll("/api/library/figures/diagram", f.data)
    .replaceAll("/api/library/figures/copy", f.data);
  assert.ok(JSON.stringify(result).length < old.length / 2);
});
test("re-saving an already cached private paper reuses its assets without another download", async () => {
  const f = fixture(),
    saved = await f.api.preparePrivateMedia("alice", source());
  f.fetched.length = 0;
  const again = await f.api.preparePrivateMedia("alice", saved);
  assert.equal(f.fetched.length, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(again.assets)),
    JSON.parse(JSON.stringify(saved.assets)),
  );
});
test("a private paper cannot be saved into a different account", async () => {
  const f = fixture();
  f.owner("bob");
  await assert.rejects(
    () => f.api.preparePrivateMedia("bob", source()),
    /another account/,
  );
  assert.equal(f.fetched.length, 0);
});
