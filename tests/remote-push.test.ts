import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
function fixture(platform: "ios" | "android" = "ios") {
  const secure = new Map<string, string>(),
    prefs = new Map<string, any>(),
    calls: any[] = [],
    prompts: boolean[] = [];
  let quietAvailable = false;
  let owner = "alice",
    allowed = true,
    online = true,
    token = "ExpoPushToken[abcdefghijklmnop]";
  const api: any = {};
  let tokenListener: ((token: any) => void) | undefined,
    nativeToken = "native-first";
  const tokenRequests: any[] = [];
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/services/remotePush.native.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText,
    {
      exports: api,
      Promise,
      Error,
      JSON,
      require: (name: string) => {
        if (name === "expo-constants")
          return { executionEnvironment: "standalone" };
        if (name === "expo-secure-store")
          return {
            getItemAsync: async (k: string) => secure.get(k),
            setItemAsync: async (k: string, v: string) => {
              secure.set(k, v);
            },
          };
        if (name === "expo-crypto") return { randomUUID };
        if (name === "expo-notifications")
          return {
            IosAuthorizationStatus: {
              NOT_DETERMINED: 0,
              AUTHORIZED: 2,
              PROVISIONAL: 3,
            },
            getPermissionsAsync: async () => ({
              granted: allowed,
              ios: { status: quietAvailable ? 0 : 2 },
            }),
            requestPermissionsAsync: async (options: any) => {
              assert.equal(options.ios.allowProvisional, false);
              return { granted: true, ios: { status: 3 } };
            },
            getExpoPushTokenAsync: async (options: any) => {
              tokenRequests.push(options);
              if (!options.devicePushToken)
                tokenListener?.({ type: "ios", data: nativeToken });
              return { data: token };
            },
            addPushTokenListener: (listener: any) => {
              tokenListener = listener;
              return {
                remove() {
                  tokenListener = undefined;
                },
              };
            },
          };
        if (name === "react-native") return { Platform: { OS: platform } };
        if (name === "../../app.json")
          return {
            expo: {
              android: { googleServicesFile: "./google-services.json" },
              extra: {
                androidPushProjectId: "test-android-project",
                eas: { projectId: "test-project" },
              },
            },
          };
        if (name === "../storage/records")
          return {
            read: async (o: string) => prefs.get(o),
            write: async (o: string, _k: string, _i: string, v: any) => {
              prefs.set(o, v);
            },
          };
        if (name === "./notifications.native")
          return {
            permission: async (prompt: boolean) => {
              prompts.push(prompt);
              if (prompt && !allowed) throw Error("permission denied");
              return allowed;
            },
          };
        if (name === "./auth")
          return {
            supabase: {
              auth: {
                getSession: async () => ({
                  data: {
                    session: owner === "guest" ? null : { user: { id: owner } },
                  },
                }),
              },
            },
          };
        if (name === "./api")
          return {
            json: (method: string, body: any) => ({ method, body }),
            request: async (path: string, options: any, auth: boolean) => {
              calls.push({ path, options, auth });
              if (!online) throw Error("offline");
              return {};
            },
          };
        throw Error(name);
      },
    },
  );
  return {
    api,
    setQuietAvailable(value: boolean) {
      quietAvailable = value;
    },
    secure,
    prefs,
    calls,
    prompts,
    tokenRequests,
    emitNative(value: string) {
      nativeToken = value;
      tokenListener?.({ type: "ios", data: value });
    },
    setOwner(v: string) {
      owner = v;
    },
    setAllowed(v: boolean) {
      allowed = v;
    },
    setOnline(v: boolean) {
      online = v;
    },
    setToken(v: string) {
      token = v;
    },
  };
}
test("remote push only prompts after explicit opt-in and re-registers a rotated token silently", async () => {
  const f = fixture();
  await f.api.refreshPush("alice");
  assert.equal(f.calls.length, 0);
  assert.equal(f.prompts.length, 0);
  await f.api.connectPush("alice");
  assert.equal(await f.api.pushStatus("alice"), true);
  assert.equal(f.calls[0].auth, true);
  f.setToken("ExpoPushToken[rotatedabcdefghijk]");
  await f.api.refreshPush("alice");
  assert.equal(
    f.calls.at(-1).options.body.token,
    "ExpoPushToken[rotatedabcdefghijk]",
  );
  assert.equal(f.prompts.filter((v) => v).length, 1);
});
test("offline sign-out retains the revocation capability and revokes before another account registers", async () => {
  const f = fixture();
  await f.api.connectPush("alice");
  f.setOnline(false);
  await assert.rejects(f.api.disconnectPush(), /offline/);
  const stored = JSON.parse([...f.secure.values()][0]);
  assert.equal(stored.owner, "alice");
  assert.ok(stored.secret);
  f.setOwner("guest");
  f.setOnline(true);
  await f.api.refreshPush("guest");
  assert.match(f.calls.at(-1).path, /revoke$/);
  assert.equal(f.calls.at(-1).auth, undefined);
  assert.equal(JSON.parse([...f.secure.values()][0]).owner, undefined);
  f.setOwner("bob");
  await f.api.connectPush("bob");
  assert.equal(await f.api.pushStatus("bob"), true);
});
test("permission denial sends no registration and revoking OS permission disconnects an existing registration", async () => {
  const f = fixture();
  f.setAllowed(false);
  await assert.rejects(f.api.connectPush("alice"), /permission/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.prefs.size, 0);
  f.setAllowed(true);
  await f.api.connectPush("alice");
  f.setAllowed(false);
  await f.api.refreshPush("alice");
  assert.match(f.calls.at(-1).path, /revoke$/);
  assert.equal(await f.api.pushStatus("alice"), false);
});

test("iOS registration events reuse the supplied native token without an endless token-refresh loop", async () => {
  const f = fixture();
  let pending: Promise<void> | undefined;
  const stop = f.api.observePushToken((native: any) => {
    pending = f.api.refreshPush("alice", native);
  });
  await f.api.connectPush("alice");
  await pending;
  assert.equal(f.tokenRequests.length, 2);
  assert.equal(f.tokenRequests[1].devicePushToken.data, "native-first");
  f.emitNative("native-first");
  assert.equal(f.tokenRequests.length, 2);
  f.emitNative("native-rotated");
  await pending;
  assert.equal(f.tokenRequests.length, 3);
  assert.equal(f.tokenRequests[2].devicePushToken.data, "native-rotated");
  stop();
});

test("first study-room arrival requests normal notification access once, registers, and respects opt-out", async () => {
  const f = fixture();
  await f.api.refreshPush("alice");
  assert.equal(f.prompts.filter(Boolean).length, 0);
  await f.api.offerInitialPush("alice");
  assert.equal(f.prompts.filter(Boolean).length, 1);
  assert.equal(f.prefs.get("alice").alertPrompted, true);
  assert.equal(await f.api.pushStatus("alice"), true);
  await f.api.offerInitialPush("alice");
  assert.equal(f.prompts.filter(Boolean).length, 1);
  await f.api.disablePush("alice");
  const count = f.calls.length;
  await f.api.offerInitialPush("alice");
  await f.api.refreshPush("alice");
  assert.equal(f.calls.length, count);
  assert.equal(f.prefs.get("alice").enabled, false);
});
test("declining the first-use prompt is remembered and never prompts again on resume", async () => {
  const f = fixture();
  f.setAllowed(false);
  await f.api.offerInitialPush("alice");
  assert.equal(f.prefs.get("alice").enabled, false);
  await f.api.offerInitialPush("alice");
  assert.equal(f.prompts.filter(Boolean).length, 1);
  assert.equal(f.calls.length, 0);
});
test("offline registration keeps opt-in so the next refresh retries without prompting", async () => {
  const f = fixture();
  f.setOnline(false);
  await assert.rejects(f.api.offerInitialPush("alice"), /offline/);
  assert.equal(f.prefs.get("alice").enabled, true);
  f.setOnline(true);
  await f.api.refreshPush("alice");
  assert.equal(await f.api.pushStatus("alice"), true);
  assert.equal(f.prompts.filter(Boolean).length, 1);
});

test("each platform registers against its own credential project", async () => {
  const android = fixture("android");
  const ios = fixture("ios");
  await android.api.connectPush("alice");
  await ios.api.connectPush("alice");
  assert.equal(android.tokenRequests[0].projectId, "test-android-project");
  assert.equal(ios.tokenRequests[0].projectId, "test-project");
});
