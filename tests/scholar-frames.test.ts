import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture(fail = false) {
  let loads = 0,
    releases = 0;
  const complete: (() => void)[] = [];
  const exports: any = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/components/scholarFrames.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Promise,
      require: (name: string) => {
        if (name === "../data/poses") return { poses: { "0-0": 1, "8-1": 2 } };
        if (name === "expo-image")
          return {
            Image: {
              loadAsync: (source: number) => {
                loads++;
                return new Promise((resolve, reject) =>
                  complete.push(() => {
                    if (fail && source === 2) reject(Error("decode failed"));
                    else
                      resolve({
                        release: () => {
                          releases++;
                        },
                      });
                  }),
                );
              },
            },
          };
        throw Error(name);
      },
    },
  );
  return {
    acquire: exports.acquireScholarFrames,
    finish: () => complete.splice(0).forEach((fn) => fn()),
    loads: () => loads,
    releases: () => releases,
  };
}
test("multiple mascot views share decoded frames and release only after the final view leaves", async () => {
  const f = fixture(),
    a = f.acquire(),
    b = f.acquire();
  assert.equal(f.loads(), 2);
  f.finish();
  const images = await a.ready;
  assert.equal(await b.ready, images);
  a.release();
  a.release();
  assert.equal(f.releases(), 0);
  b.release();
  assert.equal(f.releases(), 2);
  const c = f.acquire();
  assert.equal(f.loads(), 4);
  f.finish();
  await c.ready;
  c.release();
  assert.equal(f.releases(), 4);
});
test("leaving before decode finishes releases pending resources without retaining hidden images", async () => {
  const f = fixture(),
    a = f.acquire();
  a.release();
  f.finish();
  await a.ready;
  assert.equal(f.releases(), 2);
});
test("one failed image warmup does not block the remaining poses or leak decoded images", async () => {
  const f = fixture(true),
    a = f.acquire();
  f.finish();
  const images = await a.ready;
  assert.equal(Object.keys(images).join(), "0-0");
  a.release();
  assert.equal(f.releases(), 1);
});
