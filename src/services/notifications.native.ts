import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as records from "../storage/records";
import {
  buildReminderPlan,
  localStudyDay,
  type ReminderPreview,
  type NotificationOpen,
} from "../domain/notifications";
import type { ReminderSettings } from "./reminders";
let activeOwner = "guest",
  studying = false;
export function configureNotificationContext(
  owner: string,
  activeExam: boolean,
) {
  activeOwner = owner;
  studying = activeExam;
}
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const owned =
      activeOwner !== "guest" &&
      notification.request.content.data?.owner === activeOwner;
    return {
      shouldPlaySound: owned && !studying,
      shouldSetBadge: false,
      shouldShowBanner: owned && !studying,
      shouldShowList: owned,
    };
  },
});
let setup: Promise<void> | undefined;
async function prepare() {
  if (!setup)
    setup = (async () => {
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("study", {
          name: "Study reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
        });
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("updates", {
          name: "Uploads and PastQ messages",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
        });
      await Notifications.setNotificationCategoryAsync("study-reminder", [
        {
          identifier: "study-now",
          buttonTitle: "Study now",
          options: { opensAppToForeground: true },
        },
      ]);
    })().catch((error) => {
      setup = undefined;
      throw error;
    });
  return setup;
}
export async function permission(request: boolean): Promise<boolean> {
  await prepare();
  let result = await Notifications.getPermissionsAsync();
  const allowed = () =>
    result.granted ||
    result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed() && request && result.canAskAgain)
    result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  if (!allowed() && request)
    throw Error(
      "Allow notifications in your phone settings to receive study reminders.",
    );
  return allowed();
}
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => {});
  return result;
}
async function plannedIds(owner: string): Promise<string[]> {
  const [stored, scheduled] = await Promise.all([
    records.read<string[]>(owner, "notification-plan", "current"),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);
  return [
    ...new Set([
      ...(Array.isArray(stored)
        ? stored.filter((id) => typeof id === "string")
        : []),
      ...scheduled
        .filter(
          (n) =>
            n.content.data?.owner === owner &&
            (n.content.data?.kind === "study-reminder" ||
              n.content.data?.screen === "Main"),
        )
        .map((n) => n.identifier),
    ]),
  ];
}
async function cancelOwned(owner: string) {
  const ids = await plannedIds(owner);
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presented
      .filter((item) => item.request.content.data?.owner === owner)
      .map((item) =>
        Notifications.dismissNotificationAsync(item.request.identifier),
      ),
  );
  await records.remove(owner, "notification-plan", "current");
}
export function cancelReminders(owner: string): Promise<void> {
  manualRevision++;
  refreshed.delete(owner);
  return serial(() => cancelOwned(owner));
}
function ensureOwner(owner: string) {
  if (owner !== activeOwner || owner === "guest")
    throw Error("Your account changed. Open your reminders again.");
}
let manualRevision = 0,
  pendingManual = 0;
export function scheduleReminders(
  owner: string,
  settings: ReminderSettings,
  preview?: ReminderPreview,
  studiedDays: string[] = [],
  requestPermission = true,
): Promise<void> {
  if (requestPermission) {
    manualRevision++;
    pendingManual++;
  }
  const result = serial(async () => {
    ensureOwner(owner);
    if (!settings.enabled) {
      await cancelOwned(owner);
      return;
    }
    const plan = buildReminderPlan(settings, preview, studiedDays);
    if (!(await permission(requestPermission))) return;
    ensureOwner(owner);
    const old = await plannedIds(owner),
      created: string[] = [];
    try {
      for (const item of plan) {
        ensureOwner(owner);
        created.push(
          await Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body: item.body,
              sound: "default",
              categoryIdentifier: "study-reminder",
              data: {
                kind: "study-reminder",
                screen: "Main",
                tab: "library",
                owner,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: item.date,
              channelId: "study",
            },
          }),
        );
      }
      ensureOwner(owner);
      await records.restore(owner, [
        { kind: "notification-plan", id: "current", value: created },
        ...(preview
          ? [{ kind: "reminder-preview", id: "current", value: preview }]
          : []),
      ]);
    } catch (error) {
      await Promise.allSettled(
        created.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
      );
      throw error;
    }
    const cleanup = await Promise.allSettled(
      old.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    const retry = old.filter((_, i) => cleanup[i].status === "rejected");
    if (retry.length)
      await records.write(owner, "notification-plan", "current", [
        ...created,
        ...retry,
      ]);
  });
  return result.finally(() => {
    if (requestPermission) pendingManual--;
  });
}
const refreshed = new Map<string, string>();
export async function refreshReminders(
  owner: string,
  studiedDays: string[],
): Promise<void> {
  if (owner === "guest" || pendingManual) return;
  const revision = manualRevision;
  const settings = await records.read<ReminderSettings>(
    owner,
    "reminders",
    "current",
  );
  if (!settings) return;
  const preview = await records.read<ReminderPreview>(
    owner,
    "reminder-preview",
    "current",
  );
  if (settings.enabled && !(await permission(false))) return;
  if (pendingManual || revision !== manualRevision) return;
  const signature = JSON.stringify([
    settings,
    preview,
    [...new Set(studiedDays)].sort(),
    localStudyDay(new Date()),
    new Date().getTimezoneOffset(),
  ]);
  if (refreshed.get(owner) === signature) return;
  await scheduleReminders(
    owner,
    settings,
    preview || undefined,
    studiedDays,
    false,
  );
  if (activeOwner === owner && manualRevision === revision)
    refreshed.set(owner, signature);
}
export async function testNotification(owner: string): Promise<void> {
  ensureOwner(owner);
  await permission(true);
  ensureOwner(owner);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "PastQ · Scholar",
      body: "Your study reminder is ready. Tap to open your library.",
      sound: "default",
      categoryIdentifier: "study-reminder",
      data: { kind: "study-reminder", owner, screen: "Main", tab: "library" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      repeats: false,
      channelId: "study",
    },
  });
}
export function observeNotificationResponses(
  listener: (event: NotificationOpen) => void,
): () => void {
  let active = true;
  const seen = new Set<string>();
  const receive = (response: Notifications.NotificationResponse | null) => {
    if (
      !active ||
      !response ||
      ![Notifications.DEFAULT_ACTION_IDENTIFIER, "study-now"].includes(
        response.actionIdentifier,
      )
    )
      return;
    const request = response.notification.request,
      id = request.identifier + ":" + response.actionIdentifier;
    if (seen.has(id)) return;
    seen.add(id);
    listener({ id, data: request.content.data || {} });
  };
  const subscription =
    Notifications.addNotificationResponseReceivedListener(receive);
  void Notifications.getLastNotificationResponseAsync()
    .then(receive)
    .catch(() => {});
  return () => {
    active = false;
    subscription.remove();
  };
}
export async function clearNotificationResponse(): Promise<void> {
  await Notifications.clearLastNotificationResponseAsync();
}
