import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import express from "express";
test("resumable HTTP upload enforces ownership, validates parts and survives repeated requests", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "transfer-http-"));
  process.env.DATA_DIR = dir;
  process.env.NODE_ENV = "test";
  process.env.AUTH_DISABLED_FOR_LOCAL_DEVELOPMENT = "false";
  process.env.SESSION_OWNER_HMAC_SECRET = "isolated-transfer-test";
  const auth = http.createServer((req, res) => {
    const id = req.headers.authorization?.replace("Bearer ", "");
    res.setHeader("Content-Type", "application/json");
    if (["alice", "bob"].includes(id))
      res.end(
        JSON.stringify({
          id,
          email: id + "@example.test",
          app_metadata: {},
          user_metadata: {},
        }),
      );
    else {
      res.statusCode = 401;
      res.end("{}");
    }
  });
  await new Promise((r) => auth.listen(0, "127.0.0.1", r));
  process.env.SUPABASE_URL = "http://127.0.0.1:" + auth.address().port;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const [{ default: routes }, store, security, push] = await Promise.all([
    import("../routes/transfers.js"),
    import("../services/vision/store.js"),
    import("../services/auth/middleware.js"),
    import("../services/notifications/native.js"),
  ]);
  const a = store.createSession({
    id: crypto.randomUUID(),
    name: "Private test",
    ownerKey: security.sessionOwnerKey("alice"),
  });
  const app = express();
  app.use(express.json());
  app.use("/api/transfers", routes);
  app.use((err, req, res, next) =>
    res.status(err.status || 500).json({ error: "Invalid body" }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    server.closeAllConnections();
    auth.closeAllConnections();
    await Promise.all([
      new Promise((r) => server.close(r)),
      new Promise((r) => auth.close(r)),
    ]);
    push.closeNativeStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base =
      "http://127.0.0.1:" + server.address().port + "/api/transfers/" + a.id,
    first = Buffer.alloc(4 * 1048576, 1),
    last = Buffer.from("end"),
    sha = (b) => crypto.createHash("sha256").update(b).digest("hex"),
    manifest = {
      files: [
        {
          name: "exam.pdf",
          size: first.length + last.length,
          hashes: [sha(first), sha(last)],
        },
      ],
    };
  const send = (route, body, token = "alice", method = "POST") =>
    fetch(base + route, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        "Content-Type": Buffer.isBuffer(body)
          ? "application/octet-stream"
          : "application/json",
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
    });
  const indexUrl=base.slice(0,base.lastIndexOf("/"));
  assert.equal((await fetch(indexUrl)).status,401);
  const own=await (await fetch(indexUrl,{headers:{Authorization:"Bearer alice"}})).json();
  assert.equal(own.total,1);assert.equal(own.items[0].id,a.id);assert.equal(own.items[0].questions,undefined);assert.equal(own.items[0].ownerKey,undefined);
  const foreign=await (await fetch(indexUrl,{headers:{Authorization:"Bearer bob"}})).json();assert.equal(foreign.total,0);
  assert.equal((await send("", manifest, null)).status, 401);
  assert.equal((await send("", manifest, "bob")).status, 404);
  assert.equal((await send("", manifest)).status, 200);
  assert.equal(
    (await send("/0/0", Buffer.alloc(first.length, 2), "alice", "PUT")).status,
    422,
  );
  assert.equal((await send("/0/0", first, "alice", "PUT")).status, 200);
  assert.equal((await send("/0/0", first, "alice", "PUT")).status, 200);
  const resumed = await (await send("", manifest)).json();
  assert.deepEqual(resumed.received, [[0]]);
  assert.equal((await send("/0/1", last, "bob", "PUT")).status, 404);
  assert.equal((await send("", undefined, "bob", "GET")).status, 404);
  assert.equal(
    (await send("", { files: [{ ...manifest.files[0], name: "changed.pdf" }] }))
      .status,
    409,
  );
});
