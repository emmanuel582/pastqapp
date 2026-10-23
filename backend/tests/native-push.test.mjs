import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as push from "../vps-overlay/services/notifications/native.js";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pastq-native-"));
  process.env.DATA_DIR = root;
  const now = Date.now();
  return {
    now,
    device: {
      installationId: randomUUID(),
      secret: randomUUID() + randomUUID(),
      token: "ExpoPushToken[abcdefghijklmnop123456]",
      platform: "ios",
    },
    close() {
      push.closeNativeStore();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
const content = {
  title: "Ready",
  body: "Review your upload",
  data: { kind: "material-ready", sessionId: "sample" },
};
test("account isolation, idempotent completion and receipts survive process restarts", async () => {
  const f = fixture();
  try {
    push.registerDevice("owner-a", "alice", f.device, f.now);
    assert.equal(push.nativeReachable("owner-b"), false);
    assert.equal(
      push.enqueueNative("owner-a", "job:1", content, f.now).queued,
      1,
    );
    push.registerDevice("owner-a", "alice", f.device, f.now + 1); // normal foreground refresh preserves pending delivery
    push.closeNativeStore();
    assert.equal(
      push.enqueueNative("owner-a", "job:1", content, f.now + 2).queued,
      0,
    );
    let sends = 0;
    await push.dispatchNative({
      now: f.now + 3,
      request: async (endpoint, payload) => {
        assert.equal(endpoint, "send");
        assert.equal(payload[0].data.owner, "alice");
        sends++;
        return [{ status: "ok", id: "ticket-1" }];
      },
    });
    assert.equal(sends, 1);
    assert.equal(push.deliveryCounts("job:1")[0].status, "receipt");
    push.closeNativeStore();
    await push.dispatchNative({
      now: f.now + 20000,
      request: async (endpoint) => {
        assert.equal(endpoint, "getReceipts");
        return { "ticket-1": { status: "ok" } };
      },
    });
    assert.equal(push.deliveryCounts("job:1")[0].status, "delivered");
    await push.dispatchNative({
      now: f.now + 90000,
      request: async () => assert.fail("duplicate"),
    });
  } finally {
    f.close();
  }
});
test("offline delivery retries and invalid-token receipts remove the expired connection", async () => {
  const f = fixture();
  try {
    push.registerDevice("a", "alice", f.device);
    push.enqueueNative("a", "retry", content, f.now);
    await push.dispatchNative({
      now: f.now,
      request: async () => {
        throw Error("offline");
      },
    });
    assert.equal(push.deliveryCounts("retry")[0].status, "pending");
    await push.dispatchNative({
      now: f.now + 61000,
      request: async () => [{ status: "ok", id: "expired" }],
    });
    await push.dispatchNative({
      now: f.now + 80000,
      request: async () => ({
        expired: { status: "error", details: { error: "DeviceNotRegistered" } },
      }),
    });
    assert.equal(push.nativeReachable("a"), false);
    assert.equal(push.deliveryCounts("retry")[0].status, "failed");
  } finally {
    f.close();
  }
});
test("account switching and signed revocation cancel old payloads without affecting other devices", async () => {
  const f = fixture();
  try {
    push.registerDevice("a", "alice", f.device);
    push.enqueueNative("a", "old-account", content);
    assert.throws(
      () =>
        push.revokeDevice({ ...f.device, secret: randomUUID() + randomUUID() }),
      /Invalid/,
    );
    push.registerDevice("b", "bob", f.device);
    assert.equal(push.nativeReachable("a"), false);
    await push.dispatchNative({
      now: f.now + 1000,
      request: async () => assert.fail("old owner push"),
    });
    assert.equal(push.deliveryCounts("old-account")[0].status, "cancelled");
    push.enqueueNative("b", "new-account", content);
    push.revokeDevice(f.device);
    assert.equal(push.nativeReachable("b"), false);
    assert.equal(push.deliveryCounts("new-account")[0].status, "cancelled");
  } finally {
    f.close();
  }
});
test("completion reconciliation deduplicates repeated saves, ignores in-flight and old uploads", async () => {
  const f = fixture();
  try {
    push.registerDevice("a", "alice", f.device);
    const session = {
      id: "sample",
      ownerKey: "a",
      status: "processing",
      updatedAt: f.now,
    };
    assert.equal(push.materialCompleted(session, f.now), undefined);
    session.status = "completed";
    assert.equal(push.materialCompleted(session, f.now).queued, 1);
    assert.equal(push.materialCompleted(session, f.now).queued, 0);
    assert.equal(
      push.materialCompleted(
        { ...session, id: "old", updatedAt: f.now - 86400001 },
        f.now,
      ),
      undefined,
    );
    assert.throws(() =>
      push.registerDevice("a", "alice", {
        ...f.device,
        token: "https://evil.test",
      }),
    );
  } finally {
    f.close();
  }
});
