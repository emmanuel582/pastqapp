import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { AbortController as NativeAbortController } from "abort-controller";
import { nativeBankFixture } from "./helpers/nativeBank";
import {
  checkCancelled,
  abortTransfer,
  cancellationReason,
} from "../src/domain/cancellation";
import { normalizeBundle } from "../src/domain/contracts";
function fixture(id: string) {
  const native = nativeBankFixture(),
    textByHash = new Map<string, string>(),
    requested: string[] = [];
  const parts = [0, 1].map((i) => {
    const text = JSON.stringify({
        questions: [
          {
            id: i + 1,
            subject: "Mathematics",
            year: "2024",
            paper: "Objective",
            question: "Question " + (i + 1),
            options: ["2", "4"],
            correct: 1,
          },
        ],
        assets: {},
      }),
      hash = createHash("sha256").update(text).digest("hex");
    textByHash.set(hash, text);
    return {
      hash,
      subject: "Mathematics",
      year: "2024",
      paper: "Objective",
      count: 1,
      bytes: Buffer.byteLength(text),
      offset: i,
    };
  });
  const manifest = {
    bundle: { id, title: id, questions: [] },
    version: "v1",
    parts,
    totalQuestions: 2,
    totalBytes: parts.reduce((n, p) => n + p.bytes, 0),
  };
  let online = true;
  const api: any = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/services/library.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: api,
      Error,
      AbortController: NativeAbortController,
      require: (p: string) => {
        if (p === "../domain/cancellation")
          return { checkCancelled, abortTransfer, cancellationReason };
        if (p === "./auth") return { supabase: null };
        if (p === "../storage/bank") return native.bank;
        if (p === "../storage/records") return native.records;
        if (p === "../domain/contracts") return { normalizeBundle };
        if (p === "./privateMedia")
          return { preparePrivateMedia: async (_o: any, b: any) => b };
        if (p === "expo-crypto")
          return {
            CryptoDigestAlgorithm: { SHA256: "sha256" },
            digestStringAsync: async (_a: string, text: string) =>
              createHash("sha256").update(text).digest("hex"),
          };
        if (p === "./downloadTransport")
          return {
            prepareParts: async () => () => {},
            pauseParts: async () => {},
            forgetParts: async () => {},
            readPart: async (_o: any, value: any, part: any) => {
              if (!online) throw Error("Offline");
              requested.push(part.hash);
              return textByHash.get(part.hash);
            },
          };
        if (p === "./api")
          return {
            request: async () => {
              throw Error("Unexpected network read");
            },
            requestText: async (path: string) => {
              if (!online) throw Error("Offline");
              const hash = path.split("/").pop()!;
              requested.push(hash);
              return textByHash.get(hash);
            },
          };
        throw Error(p);
      },
    },
  );
  return {
    ...native,
    api,
    manifest,
    requested,
    offline() {
      online = false;
    },
  };
}
for (const id of ["waec-2027", "utme-testdriller-2027", "personal-paper"])
  test(
    id +
      ": real native signal can download, pause, resume and reopen from SQLite offline",
    async () => {
      const f = fixture(id);
      try {
        const first = new NativeAbortController();
        assert.equal((first.signal as any).throwIfAborted, undefined);
        await assert.rejects(
          f.api.download(
            "alice",
            f.manifest,
            f.manifest.parts.map((p) => p.hash),
            first.signal,
            (done: number) => {
              if (done > 0) first.abort();
            },
          ),
          { name: "AbortError" },
        );
        assert.equal(f.requested.length, 1);
        assert.equal(await f.bank.readIndex("alice", id), null);
        const second = new NativeAbortController();
        await f.api.download(
          "alice",
          f.manifest,
          f.manifest.parts.map((p) => p.hash),
          second.signal,
          () => {},
        );
        assert.equal(
          f.requested.length,
          2,
          "resume reuses the verified first part",
        );
        f.offline();
        const saved = await f.api.getBundle("alice", id);
        assert.equal(saved.questions.length, 2);
        assert.equal(saved.question_count, 2);
        assert.equal(
          (await f.bank.resolveQuestion("alice", saved.questions[1])).question
            .question,
          "Question 2",
        );
        assert.equal(await f.bank.readIndex("bob", id), null);
      } finally {
        f.sqlite.close();
      }
    },
  );
test("cancellation accepts React Native signals and aborts before any network or disk staging", async () => {
  const f = fixture("aborted");
  try {
    const c = new NativeAbortController();
    c.abort();
    await assert.rejects(
      f.api.download(
        "alice",
        f.manifest,
        [f.manifest.parts[0].hash],
        c.signal,
        () => {},
      ),
      { name: "AbortError" },
    );
    assert.equal(f.requested.length, 0);
    checkCancelled();
  } finally {
    f.sqlite.close();
  }
});

for (const reason of ["background-expired", "account-changed", undefined])
  test(`native cancellation keeps recovery intent: ${reason || "manual pause"}`, async () => {
    const f = fixture("recovery-reason"),
      c = new NativeAbortController();
    try {
      await assert.rejects(
        f.api.download(
          "alice",
          f.manifest,
          f.manifest.parts.map((p) => p.hash),
          c.signal,
          (done: number) => {
            if (done > 0)
              abortTransfer(c as unknown as AbortController, reason);
          },
        ),
        { name: "AbortError" },
      );
      const plan: any = await f.records.read(
        "alice",
        "download-plan",
        f.manifest.bundle.id,
      );
      assert.equal(plan.paused, reason === undefined);
    } finally {
      f.sqlite.close();
    }
  });
