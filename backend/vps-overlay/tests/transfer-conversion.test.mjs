import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import express from "express";
test("Word upload is converted, PDF pages persist and a restart reuses stable page IDs", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conversion-http-"));
  process.env.DATA_DIR = dir;
  process.env.NODE_ENV = "test";
  process.env.AUTH_DISABLED_FOR_LOCAL_DEVELOPMENT = "false";
  process.env.SESSION_OWNER_HMAC_SECRET = "isolated-conversion";
  const provider = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "alice",
        email: "alice@example.test",
        app_metadata: {},
        user_metadata: {},
      }),
    );
  });
  await new Promise((r) => provider.listen(0, "127.0.0.1", r));
  process.env.SUPABASE_URL = "http://127.0.0.1:" + provider.address().port;
  process.env.SUPABASE_ANON_KEY = "test";
  const [
    { default: routes },
    store,
    auth,
    pages,
    push,
    { ingestTransferredPdf },
  ] = await Promise.all([
    import("../routes/transfers.js"),
    import("../services/vision/store.js"),
    import("../services/auth/middleware.js"),
    import("../services/vision/pageStore.js"),
    import("../services/notifications/native.js"),
    import("../services/vision/transferPdf.js"),
  ]);
  const session = store.createSession({
    id: crypto.randomUUID(),
    name: "Word notes",
    ownerKey: auth.sessionOwnerKey("alice"),
  });
  const app = express();
  app.use(express.json());
  app.use("/api/transfers", routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    server.closeAllConnections();
    provider.closeAllConnections();
    await Promise.all([
      new Promise((r) => server.close(r)),
      new Promise((r) => provider.close(r)),
    ]);
    push.closeNativeStore();
    pages.closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const bytes = fs.readFileSync(
      new URL("./fixtures/student.docx", import.meta.url),
    ),
    hash = crypto.createHash("sha256").update(bytes).digest("hex"),
    base =
      "http://127.0.0.1:" +
      server.address().port +
      "/api/transfers/" +
      session.id;
  const prepared = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: "Bearer alice",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: [{ name: "student.docx", size: bytes.length, hashes: [hash] }],
    }),
  });
  assert.equal(prepared.status, 200);
  assert.equal(
    (
      await fetch(base + "/0/0", {
        method: "PUT",
        headers: {
          Authorization: "Bearer alice",
          "Content-Type": "application/octet-stream",
        },
        body: bytes,
      })
    ).status,
    200,
  );
  let state;
  const until = Date.now() + 30000;
  do {
    state = await (
      await fetch(base, { headers: { Authorization: "Bearer alice" } })
    ).json();
    if (["accepted", "failed"].includes(state.status)) break;
    await new Promise((r) => setTimeout(r, 200));
  } while (Date.now() < until);
  assert.equal(state.status, "accepted", state.error);
  const list = pages.listPages(session.id);
  assert.equal(list.length, 1);
  assert.ok(fs.existsSync(list[0].imagePath));
  assert.equal(store.getSession(session.id).ingest.status, "done");
  await ingestTransferredPdf(
    session.id,
    path.join(store.pageDir(session.id), "transfer-source.pdf"),
  );
  assert.deepEqual(
    pages.listPages(session.id).map((p) => p.id),
    list.map((p) => p.id),
  );
});
