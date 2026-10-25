import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import appConfig from "../../app.json";
import * as records from "../storage/records";
import { permission } from "./notifications.native";
import { request, json } from "./api";
import { supabase } from "./auth";
interface Device {
  installationId: string;
  secret: string;
  owner?: string;
  token?: string;
}
const key = "pastq-push-installation-v1";
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}
async function device(): Promise<Device> {
  const value = await SecureStore.getItemAsync(key);
  if (value) return JSON.parse(value);
  const created = {
    installationId: Crypto.randomUUID(),
    secret: Crypto.randomUUID() + Crypto.randomUUID(),
  };
  await SecureStore.setItemAsync(key, JSON.stringify(created));
  return created;
}
async function ensureOwner(owner: string) {
  if (
    owner === "guest" ||
    (await supabase?.auth.getSession())?.data.session?.user.id !== owner
  )
    throw Error("Your account changed. Open notifications again.");
}
async function revoke(d: Device) {
  await request("/api/reminders/native-device/revoke", {
    ...json("POST", { installationId: d.installationId, secret: d.secret }),
    timeoutMs: 5000,
  });
  await SecureStore.setItemAsync(
    key,
    JSON.stringify({ installationId: d.installationId, secret: d.secret }),
  );
}
export async function pushStatus(owner: string): Promise<boolean> {
  const value = await records.read<{ enabled: boolean }>(
    owner,
    "remote-push",
    "current",
  );
  if (!value?.enabled || !(await permission(false))) return false;
  return (await device()).owner === owner;
}
async function register(
  owner: string,
  prompt: boolean,
  deviceToken?: Notifications.DevicePushToken,
) {
  if (Constants.executionEnvironment === "storeClient")
    throw Error(
      "Open the installed focalPoint app to enable phone notifications. Expo Go supports local study reminders only.",
    );
  if (
    Platform.OS === "android" &&
    !("googleServicesFile" in appConfig.expo.android)
  )
    throw Error(
      "Phone notifications are not available in this Android build yet. Messages from focalPoint still appear in your inbox.",
    );
  await ensureOwner(owner);
  if (!(await permission(prompt))) return;
  const d = await device();
  if (d.owner && d.owner !== owner) await revoke(d);
  let token: string;
  try {
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: appConfig.expo.extra.eas.projectId,
        devicePushToken: deviceToken,
      })
    ).data;
  } catch {
    throw Error(
      "This build could not connect to phone notifications. Check your internet connection and use the latest installed focalPoint app.",
    );
  }
  await ensureOwner(owner);
  // Keep the revocation capability before any network request, including a lost response.
  await SecureStore.setItemAsync(key, JSON.stringify({ ...d, owner, token }));
  await request(
    "/api/reminders/native-device",
    {
      ...json("PUT", {
        installationId: d.installationId,
        secret: d.secret,
        token,
        platform: Platform.OS,
      }),
      owner,
    },
    true,
  );
  await ensureOwner(owner);
}
export function connectPush(owner: string): Promise<void> {
  return serial(async () => {
    if (await quietPush()) {
      await ensureOwner(owner);
      const result = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowSound: true,
          allowBadge: false,
          allowProvisional: false,
        },
      });
      if (
        !result.granted ||
        result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      )
        throw Error(
          "Enable notification alerts in your iPhone settings for banners and sound.",
        );
    }
    await register(owner, true);
    await records.write(owner, "remote-push", "current", {
      enabled: true,
      alertPrompted: true,
    });
  });
}
export function disablePush(owner: string): Promise<void> {
  return serial(async () => {
    await records.write(owner, "remote-push", "current", { enabled: false });
    const d = await device();
    if (d.owner === owner) await revoke(d);
  });
}
export function disconnectPush(): Promise<void> {
  return serial(async () => {
    const d = await device();
    if (d.owner) await revoke(d);
  });
}
export function refreshPush(
  owner: string,
  deviceToken?: Notifications.DevicePushToken,
): Promise<void> {
  return serial(async () => {
    const d = await device();
    if (d.owner && d.owner !== owner) await revoke(d);
    if (owner === "guest") return;
    const value = await records.read<{ enabled: boolean }>(
      owner,
      "remote-push",
      "current",
    );
    if (value?.enabled) {
      if (await permission(false)) await register(owner, false, deviceToken);
      else if (d.owner === owner) await revoke(d);
    } else if (d.owner === owner) await revoke(d);
  });
}
/** Ask once, after the student has entered their study room. Never override opt-out. */
export function offerInitialPush(owner: string): Promise<void> {
  return serial(async () => {
    if (owner === "guest" || Constants.executionEnvironment === "storeClient")
      return;
    await ensureOwner(owner);
    const old = await records.read<{
      enabled: boolean;
      alertPrompted?: boolean;
    }>(owner, "remote-push", "current");
    if (old?.enabled === false || old?.alertPrompted) return;
    // Persist before the OS dialog: app resume/token events cannot prompt a second time.
    await records.write(owner, "remote-push", "current", {
      ...old,
      enabled: true,
      alertPrompted: true,
    });
    try {
      if (await quietPush()) {
        const result = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowSound: true,
            allowBadge: false,
            allowProvisional: false,
          },
        });
        if (
          !result.granted ||
          result.ios?.status ===
            Notifications.IosAuthorizationStatus.PROVISIONAL
        )
          return;
      } else if (!(await permission(true))) return;
    } catch {
      await ensureOwner(owner);
      await records.write(owner, "remote-push", "current", {
        enabled: false,
        alertPrompted: true,
      });
      return;
    }
    await ensureOwner(owner);
    await register(owner, false);
  });
}

export function observePushToken(
  listener: (token: Notifications.DevicePushToken) => void,
): () => void {
  if (Constants.executionEnvironment === "storeClient") return () => {};
  let previous = "";
  const sub = Notifications.addPushTokenListener((token) => {
    const signature = JSON.stringify(token);
    if (signature === previous) return;
    previous = signature;
    listener(token);
  });
  return () => sub.remove();
}

export async function quietPush(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return (
    (await Notifications.getPermissionsAsync()).ios?.status ===
    Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}
