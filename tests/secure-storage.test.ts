import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture() {
  const values = new Map<string, string>();
  let before: ((op: string, key: string) => Promise<void>) | undefined;
  const exports: any = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/secure.native.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (name: string) => {
        if (name !== "expo-secure-store") throw Error(name);
        return {
          getItemAsync: async (k: string) => {
            await before?.("get", k);
            return values.get(k) ?? null;
          },
          setItemAsync: async (k: string, v: string) => {
            await before?.("set", k);
            values.set(k, v);
          },
          deleteItemAsync: async (k: string) => {
            await before?.("remove", k);
            values.delete(k);
          },
        };
      },
    },
  );
  return {
    storage: exports.secureStorage,
    values,
    hook: (fn: typeof before) => (before = fn),
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
test("existing chunk format and Unicode sessions round trip without loss", async () => {
  const f = fixture();
  f.values.set("auth.head", "legacy");
  f.values.set("auth.legacy.count", "1");
  f.values.set("auth.legacy.0", JSON.stringify("old-session"));
  assert.equal(await f.storage.getItem("auth"), "old-session");
  const value = JSON.stringify({ name: "学生 👩🏾‍🎓", token: "a".repeat(6000) });
  await f.storage.setItem("auth", value);
  assert.equal(await f.storage.getItem("auth"), value);
  assert.equal(f.values.has("auth.legacy.0"), false);
});
test("sign-out during token persistence cannot resurrect the signed-out session", async () => {
  const f = fixture();
  await f.storage.setItem("auth", "old");
  const paused = deferred(),
    resume = deferred();
  let held = false;
  f.hook(async (op, key) => {
    if (op === "set" && key.endsWith(".0") && !held) {
      held = true;
      paused.resolve();
      await resume.promise;
    }
  });
  const write = f.storage.setItem("auth", "new");
  await paused.promise;
  const remove = f.storage.removeItem("auth");
  resume.resolve();
  await Promise.all([write, remove]);
  assert.equal(await f.storage.getItem("auth"), null);
});
test("refresh preserves an in-flight reader until it has consumed the old generation", async () => {
  const f = fixture();
  await f.storage.setItem("auth", "old");
  const old = f.values.get("auth.head")!,
    paused = deferred(),
    resume = deferred();
  let held = false;
  f.hook(async (op, key) => {
    if (op === "get" && key === "auth." + old + ".0" && !held) {
      held = true;
      paused.resolve();
      await resume.promise;
    }
  });
  const read = f.storage.getItem("auth");
  await paused.promise;
  const write = f.storage.setItem("auth", "new");
  resume.resolve();
  assert.equal(await read, "old");
  await write;
  assert.equal(await f.storage.getItem("auth"), "new");
});
test("failed refresh and oversized values preserve the previously saved session", async () => {
  const f = fixture();
  await f.storage.setItem("auth", "old");
  f.hook(async (op, key) => {
    if (op === "set" && key.endsWith(".1")) throw Error("storage full");
  });
  await assert.rejects(
    () => f.storage.setItem("auth", "n".repeat(3000)),
    /storage full/,
  );
  f.hook(undefined);
  assert.equal(await f.storage.getItem("auth"), "old");
  await assert.rejects(
    () => f.storage.setItem("auth", "n".repeat(180000)),
    /too large/,
  );
  assert.equal(await f.storage.getItem("auth"), "old");
});
test("malformed metadata fails safely and deletion remains bounded", async () => {
  const f = fixture();
  f.values.set("auth.head", "bad");
  f.values.set("auth.bad.count", "Infinity");
  assert.equal(await f.storage.getItem("auth"), null);
  await f.storage.removeItem("auth");
  assert.equal(f.values.has("auth.head"), false);
});
