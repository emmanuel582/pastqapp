import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as domain from "../src/domain/notifications";
import { reminderDefaults } from "../src/domain/reminders";
function fixture() {
  const owner = "alice",
    store = new Map<string, any>(),
    scheduled = new Map<string, any>(),
    cancelled: string[] = [],
    presented = new Map<string, any>();
  let count = 0,
    failure = 0,
    handler: any;
  let allowed: any = { granted: true, canAskAgain: true };
  let requestPermission: () => Promise<any> = async () => allowed;
  const settings = {
    ...reminderDefaults,
    enabled: true,
    mode: "scheduled",
    time: "18:00",
  };
  const key = (o: string, k: string, id: string) => o + ":" + k + ":" + id;
  const records = {
    read: async (o: string, k: string, id: string) =>
      store.get(key(o, k, id)) ?? null,
    write: async (o: string, k: string, id: string, value: any) => {
      store.set(key(o, k, id), value);
    },
    restore: async (o: string, rows: any[]) => {
      for (const row of rows) store.set(key(o, row.kind, row.id), row.value);
    },
    remove: async (o: string, k: string, id: string) => {
      store.delete(key(o, k, id));
    },
  };
  const Notifications: any = {
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: {
      DATE: "date",
      TIME_INTERVAL: "timeInterval",
    },
    DEFAULT_ACTION_IDENTIFIER: "default",
    setNotificationHandler: (value: any) => {
      handler = value;
    },
    setNotificationChannelAsync: async () => {},
    setNotificationCategoryAsync: async () => {},
    getPermissionsAsync: async () => allowed,
    requestPermissionsAsync: async () => requestPermission(),
    getPresentedNotificationsAsync: async () => [...presented.values()],
    dismissNotificationAsync: async (id: string) => {
      presented.delete(id);
    },
    getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
    cancelScheduledNotificationAsync: async (id: string) => {
      cancelled.push(id);
      scheduled.delete(id);
    },
    scheduleNotificationAsync: async (input: any) => {
      count++;
      if (failure && count === failure) throw Error("device schedule failed");
      const id = "new-" + count;
      scheduled.set(id, { ...input, identifier: id });
      return id;
    },
  };
  const exports: any = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/notifications.native.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Date,
      Map,
      Set,
      Promise,
      console,
      require: (name: string) => {
        if (name === "expo-notifications") return Notifications;
        if (name === "react-native") return { Platform: { OS: "ios" } };
        if (name === "../storage/records") return records;
        if (name === "../domain/notifications") return domain;
        throw Error(name);
      },
    },
  );
  exports.configureNotificationContext(owner, false);
  scheduled.set("old", {
    identifier: "old",
    content: { data: { kind: "study-reminder", owner } },
  });
  store.set(key(owner, "notification-plan", "current"), ["old"]);
  return {
    api: exports,
    records,
    owner,
    settings,
    scheduled,
    cancelled,
    presented,
    get handler() {
      return handler;
    },
    permission: (value: any) => {
      allowed = value;
    },
    failAt: (n: number) => {
      failure = n;
    },
    onPermission: (value: () => Promise<any>) => {
      requestPermission = value;
    },
  };
}
test("denied device permission leaves the previous reminder plan intact", async () => {
  const f = fixture();
  f.permission({ granted: false, canAskAgain: false });
  await assert.rejects(
    f.api.scheduleReminders(f.owner, f.settings),
    /Allow notifications/,
  );
  assert.equal(f.scheduled.has("old"), true);
  assert.equal(f.cancelled.length, 0);
});
test("partial native scheduling failure rolls back new requests and preserves the old plan", async () => {
  const f = fixture();
  f.failAt(3);
  await assert.rejects(
    f.api.scheduleReminders(f.owner, f.settings),
    /device schedule failed/,
  );
  assert.equal(f.scheduled.size, 1);
  assert.equal(f.scheduled.has("old"), true);
  assert.deepEqual(
    await f.records.read(f.owner, "notification-plan", "current"),
    ["old"],
  );
});
test("native replacement accepts provisional iOS permission and removes obsolete requests", async () => {
  const f = fixture();
  f.permission({ granted: false, canAskAgain: false, ios: { status: 3 } });
  await f.api.scheduleReminders(f.owner, f.settings);
  assert.equal(f.scheduled.has("old"), false);
  assert.ok(f.scheduled.size > 0 && f.scheduled.size <= 28);
  assert.ok(
    [...f.scheduled.values()].every((n) => n.content.data.owner === f.owner),
  );
});
test("reminder renewal skips newly studied days and rebuilds after account cleanup", async () => {
  const f = fixture();
  await f.records.write(f.owner, "reminders", "current", f.settings);
  await f.api.refreshReminders(f.owner, []);
  await f.api.cancelReminders(f.owner);
  assert.equal(f.scheduled.size, 0);
  await f.api.refreshReminders(f.owner, []);
  assert.ok(f.scheduled.size > 0);
  const day = domain.localStudyDay(new Date());
  await f.api.refreshReminders(f.owner, [day]);
  assert.ok(
    [...f.scheduled.values()].every(
      (n) => domain.localStudyDay(n.trigger.date) !== day,
    ),
  );
});
test("automatic renewal cannot cancel a plan while its permission dialog is open", async () => {
  const f = fixture();
  await f.records.write(f.owner, "reminders", "current", {
    ...f.settings,
    enabled: false,
  });
  f.permission({ granted: false, canAskAgain: true });
  let allow!: (value: any) => void;
  f.onPermission(
    () =>
      new Promise((resolve) => {
        allow = resolve;
      }),
  );
  const save = f.api.scheduleReminders(f.owner, f.settings);
  while (!allow) await new Promise((resolve) => setTimeout(resolve, 0));
  await f.api.refreshReminders(f.owner, []);
  allow({ granted: true, canAskAgain: true });
  await save;
  assert.ok(f.scheduled.size > 0);
  assert.equal(f.scheduled.has("old"), false);
});
test("foreground reminders stay quiet during CBT and hide another account's content", async () => {
  const f = fixture(),
    n = { request: { content: { data: { owner: f.owner } } } };
  f.api.configureNotificationContext(f.owner, true);
  assert.equal((await f.handler.handleNotification(n)).shouldShowBanner, false);
  f.api.configureNotificationContext(f.owner, false);
  assert.equal((await f.handler.handleNotification(n)).shouldShowBanner, true);
  f.api.configureNotificationContext("bob", false);
  const hidden = await f.handler.handleNotification(n);
  assert.equal(hidden.shouldShowBanner, false);
  assert.equal(hidden.shouldShowList, false);
});

test("account cleanup dismisses only that account’s delivered notifications", async () => {
  const f = fixture();
  for (const owner of [f.owner, "bob"])
    f.presented.set(owner, {
      request: { identifier: owner, content: { data: { owner } } },
    });
  await f.api.cancelReminders(f.owner);
  assert.equal(f.presented.has(f.owner), false);
  assert.equal(f.presented.has("bob"), true);
  assert.equal(f.scheduled.size, 0);
});
