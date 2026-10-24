import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useApp } from "../state/AppContext";
import { supabase } from "../services/auth";
import { Screen, Loading } from "../components/ui";
import { useReducedMotion } from "../hooks/useReducedMotion";
import NativeNotificationBridge from "../components/NativeNotificationBridge";
import type { Routes } from "./types";
const Stack = createNativeStackNavigator<Routes>(),
  ref = createNavigationContainerRef<Routes>();
export default function RootNavigator() {
  const [activeRoute, setActiveRoute] = useState<string | undefined>();
  const { ready, session, profile, owner, palette } = useApp(),
    reduced = useReducedMotion();
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY")
        setTimeout(() => {
          if (ref.isReady()) ref.navigate("Auth", { mode: "recovery" });
        }, 50);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready || (session && (!profile || profile.id !== session.user.id)))
    return (
      <Screen>
        <Loading label="Opening your study room…" />
      </Screen>
    );
  let initial: keyof Routes = profile
    ? profile.onboarding_complete
      ? "Main"
      : "Onboarding"
    : "Welcome";
  const theme = {
    ...(palette.scheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(palette.scheme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: palette.bg,
      card: palette.panel,
      text: palette.ink,
      border: palette.line,
      primary: palette.accent,
    },
  };
  return (
    <>
      <StatusBar style={palette.scheme === "dark" ? "light" : "dark"} />
      <NavigationContainer
        ref={ref}
        onReady={() => setActiveRoute(ref.getCurrentRoute()?.name)}
        onStateChange={() => setActiveRoute(ref.getCurrentRoute()?.name)}
        theme={theme}
        key={owner + ":" + (profile?.onboarding_complete ? "ready" : "new")}
      >
        <NativeNotificationBridge
          navigationRef={ref}
          activeRoute={activeRoute}
        />
        <Stack.Navigator
          initialRouteName={initial}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.bg },
            animation:
              reduced || Platform.OS === "web" ? "none" : "slide_from_right",
            animationDuration: 240,
          }}
        >
          <Stack.Screen
            name="Welcome"
            getComponent={() => require("../screens/WelcomeScreen").default}
          />
          <Stack.Screen
            name="Auth"
            getComponent={() => require("../screens/AuthScreen").default}
          />
          <Stack.Screen
            name="Onboarding"
            getComponent={() => require("../screens/OnboardingScreen").default}
          />
          <Stack.Screen
            name="Main"
            getComponent={() => require("../screens/MainScreen").default}
          />
          <Stack.Screen
            name="Setup"
            getComponent={() => require("../screens/SetupScreen").default}
          />
          <Stack.Screen
            name="Download"
            getComponent={() => require("../screens/DownloadScreen").default}
          />
          <Stack.Screen
            name="Exam"
            options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            getComponent={() => require("../screens/ExamScreen").default}
          />
          <Stack.Screen
            name="Results"
            getComponent={() => require("../screens/ResultsScreen").default}
          />
          <Stack.Screen
            name="Upload"
            getComponent={() => require("../screens/UploadScreen").default}
          />
          <Stack.Screen
            name="Manual"
            getComponent={() => require("../screens/ManualScreen").default}
          />
          <Stack.Screen
            name="Processing"
            getComponent={() => require("../screens/ProcessingScreen").default}
          />
          <Stack.Screen
            name="ReviewMaterial"
            getComponent={() =>
              require("../screens/ReviewMaterialScreen").default
            }
          />
          <Stack.Screen
            name="Theme"
            getComponent={() => require("../screens/ThemeScreen").default}
          />
          <Stack.Screen
            name="Reminders"
            getComponent={() => require("../screens/RemindersScreen").default}
          />
          <Stack.Screen
            name="Notifications"
            getComponent={() =>
              require("../screens/NotificationsScreen").default
            }
          />
          <Stack.Screen
            name="Progress"
            getComponent={() => require("../screens/ProgressScreen").default}
          />
          <Stack.Screen
            name="History"
            getComponent={() => require("../screens/HistoryScreen").default}
          />
          <Stack.Screen
            name="Saved"
            getComponent={() => require("../screens/SavedScreen").default}
          />
          <Stack.Screen
            name="Storage"
            getComponent={() => require("../screens/StorageScreen").default}
          />
          <Stack.Screen
            name="Reports"
            getComponent={() => require("../screens/ReportsScreen").default}
          />
          <Stack.Screen
            name="Profile"
            getComponent={() => require("../screens/ProfileScreen").default}
          />
          <Stack.Screen
            name="About"
            getComponent={() => require("../screens/InfoScreen").default}
          />
          <Stack.Screen
            name="Privacy"
            getComponent={() => require("../screens/InfoScreen").default}
          />
          <Stack.Screen
            name="Terms"
            getComponent={() => require("../screens/InfoScreen").default}
          />
          <Stack.Screen
            name="DeleteAccount"
            getComponent={() => require("../screens/InfoScreen").default}
          />
          <Stack.Screen
            name="Support"
            getComponent={() => require("../screens/InfoScreen").default}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
