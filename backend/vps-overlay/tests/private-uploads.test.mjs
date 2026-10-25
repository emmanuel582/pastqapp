import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
test("only verified admins can mark uploads for shared publication; student inputs cannot widen access", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "private-material-"));
  process.env.DATA_DIR = dir;
  process.env.NODE_ENV = "test";
  process.env.AUTH_DISABLED_FOR_LOCAL_DEVELOPMENT = "false";
  process.env.SESSION_OWNER_HMAC_SECRET = "test-publication-gate";
  const provider = http.createServer((req, res) => {
    const id = req.headers.authorization?.replace("Bearer ", "");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id,
        email: id + "@example.test",
        app_metadata: id === "admin" ? { role: "admin" } : {},
        user_metadata: {},
      }),
    );
  });
  await new Promise((r) => provider.listen(0, "127.0.0.1", r));
  process.env.SUPABASE_URL = "http://127.0.0.1:" + provider.address().port;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const [{ default: routes }, store, sync, push] = await Promise.all([
    import("../routes/vision.js"),
    import("../services/vision/store.js"),
    import("../services/library/librarySync.js"),
    import("../services/notifications/native.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/vision", routes);
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
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const create = async (token) => {
    const r = await fetch(
      "http://127.0.0.1:" + server.address().port + "/api/vision/sessions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Isolated upload",
          publishToLibrary: true,
          isAdmin: true,
        }),
      },
    );
    assert.equal(r.status, 200);
    return store.getSession((await r.json()).id);
  };
  const student = await create("student");
  assert.equal(student.publishToLibrary, false);
  assert.deepEqual(
    await sync.syncSessionToLibrary({
      ...student,
      status: "completed",
      questions: [{ id: 1 }],
    }),
    { synced: false, reason: "private_upload" },
  );
  const admin = await create("admin");
  assert.equal(admin.publishToLibrary, true);
  assert.equal(
    sync.shouldSyncToLibrary({
      ...admin,
      status: "completed",
      questions: [{ id: 1 }],
    }),
    true,
  );
  assert.equal(
    sync.shouldSyncToLibrary({ status: "completed", questions: [{ id: 1 }] }),
    false,
    "legacy uploads are not automatically re-published",
  );
});
