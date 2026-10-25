import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture(marker: string | null, saved: boolean) {
  const calls: string[] = [];
  const api: any = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/confirmedMaterial.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports: api,
      encodeURIComponent,
      require: (name: string) => {
        if (name === "../storage/records")
          return {
            read: async (_owner: string, kind: string) =>
              kind === "confirmed-material"
                ? marker
                : saved
                  ? { id: "material" }
                  : null,
          };
        if (name === "./api")
          return {
            request: async (url: string) => {
              calls.push(url);
              return { id: "material", questions: [] };
            },
          };
        if (name === "./library")
          return { saveBundle: async () => calls.push("saved") };
        throw Error(name);
      },
    },
  );
  return { api, calls };
}
test("a stale local completion cannot bypass current server checks", async () => {
  const { api, calls } = fixture("old-material", true);
  assert.equal(
    await api.confirmedMaterial("student", {
      id: "upload",
      status: "completed",
      approvedAt: null,
    }),
    null,
  );
  assert.deepEqual(calls, []);
});
test("server approval restores a completed upload on a new device", async () => {
  const { api, calls } = fixture(null, false);
  assert.equal(
    await api.confirmedMaterial("student", {
      id: "upload",
      status: "completed",
      approvedAt: "2026-10-25T00:00:00Z",
    }),
    "upload",
  );
  assert.deepEqual(calls, ["/api/vision/materials/upload", "saved"]);
});
test("previously confirmed offline materials remain available on older cached session records", async () => {
  const { api, calls } = fixture("material", true);
  assert.equal(
    await api.confirmedMaterial("student", {
      id: "upload",
      status: "completed",
    }),
    "material",
  );
  assert.deepEqual(calls, []);
});
