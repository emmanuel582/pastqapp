import { refreshPush, observePushToken } from "../services/remotePush";
import React, { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { useApp } from "../state/AppContext";
import {
  localStudyDay,
  notificationDestination,
  type NotificationOpen,
} from "../domain/notifications";
import {
  cancelReminders,
  clearNotificationResponse,
  configureNotificationContext,
  observeNotificationResponses,
  refreshReminders,
} from "../services/notifications";
import type { Routes } from "../navigation/types";
export default function NativeNotificationBridge({
  navigationRef,
  activeRoute,
}: {
  navigationRef: NavigationContainerRefWithCurrent<Routes>;
  activeRoute: string | undefined;
}) {
  const { owner, attempts } = useApp();
  const [pending, setPending] = useState<NotificationOpen | null>(null);
  const days = useMemo(
    () =>
      [
        ...new Set(
          attempts
            .filter((a) => a.status === "completed" && a.completedAt)
            .map((a) => localStudyDay(new Date(a.completedAt!))),
        ),
      ].sort(),
    [attempts],
  );
  const daysKey = days.join(",");
  useEffect(() => {
    configureNotificationContext(owner, activeRoute === "Exam");
  }, [owner, activeRoute]);
  useEffect(() => observeNotificationResponses(setPending), []);
  useEffect(
    () =>
      observePushToken((token) => {
        void refreshPush(owner, token).catch(() => {});
      }),
    [owner],
  );
  useEffect(() => {
    const refresh = () => {
      if (AppState.currentState === "active")
        void Promise.allSettled([
          refreshReminders(owner, days),
          refreshPush(owner),
        ]);
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [owner, daysKey]);
  useEffect(
    () => () => {
      configureNotificationContext("guest", false);
      void cancelReminders(owner).catch(() => {});
    },
    [owner],
  );
  useEffect(() => {
    if (!pending || !navigationRef.isReady() || activeRoute === "Exam") return;
    const destination = notificationDestination(pending.data, owner);
    setPending(null);
    void clearNotificationResponse().catch(() => {});
    if (destination?.screen === "Main")
      navigationRef.navigate("Main", { tab: destination.tab });
    else if (destination?.screen === "ReviewMaterial")
      navigationRef.navigate("ReviewMaterial", {
        sessionId: destination.sessionId,
      });
    else if (destination?.screen === "Notifications")
      navigationRef.navigate("Notifications");
  }, [pending, owner, activeRoute, navigationRef]);
  return null;
}
