import React, { useEffect } from "react";
import { Platform } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useApp, designPreview } from "../state/AppContext";
import { supabase } from "../services/auth";
import { Screen, Loading } from "../components/ui";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { Routes } from "./types";
const Stack = createNativeStackNavigator<Routes>(),
  ref = createNavigationContainerRef<Routes>();
export default function RootNavigator() {
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
  let params: Routes[keyof Routes] | undefined;
  const preview =
    designPreview && Platform.OS === "web"
      ? new URL(globalThis.location.href).searchParams.get("screen")
      : null;
  const mapped: Record<
    string,
    { name: keyof Routes; params?: Routes[keyof Routes] }
  > = {
    welcome: { name: "Welcome" },
    login: { name: "Auth", params: { mode: "login" } },
    signup: { name: "Auth", params: { mode: "signup" } },
    onboarding: { name: "Onboarding" },
    home: { name: "Main", params: { tab: "home" } },
    library: { name: "Main", params: { tab: "library" } },
    discover: { name: "Main", params: { tab: "discover" } },
    preferences: { name: "Main", params: { tab: "preferences" } },
    theme: { name: "Theme" },
    setup: { name: "Setup", params: { bundleId: "design-preview" } },
    upload: { name: "Upload" },
    saved: { name: "Saved" },
    history: { name: "History" },
    storage: { name: "Storage" },
    reports: { name: "Reports" },
    reminders: { name: "Reminders" },
    notifications: { name: "Notifications" },
  };
  if (preview && mapped[preview]) {
    initial = mapped[preview].name;
    params = mapped[preview].params;
  }
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
        theme={theme}
        key={owner + ":" + (profile?.onboarding_complete ? "ready" : "new")}
      >
        <Stack.Navigator
          initialRouteName={initial}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.bg },
            animation: reduced ? "none" : "fade",
            animationDuration: 240,
          }}
        >
          <Stack.Screen
            name="Welcome"
            getComponent={() => require("../screens/WelcomeScreen").default}
          />
          <Stack.Screen
            name="Auth"
            initialParams={
              initial === "Auth" ? (params as Routes["Auth"]) : undefined
            }
            getComponent={() => require("../screens/AuthScreen").default}
          />
          <Stack.Screen
            name="Onboarding"
            getComponent={() => require("../screens/OnboardingScreen").default}
          />
          <Stack.Screen
            name="Main"
            initialParams={
              initial === "Main" ? (params as Routes["Main"]) : undefined
            }
            getComponent={() => require("../screens/MainScreen").default}
          />
          <Stack.Screen
            name="Setup"
            initialParams={
              initial === "Setup" ? (params as Routes["Setup"]) : undefined
            }
            getComponent={() => require("../screens/SetupScreen").default}
          />
          <Stack.Screen
            name="Download"
            getComponent={() => require("../screens/DownloadScreen").default}
          />
          <Stack.Screen
            name="Exam"
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
            name="Support"
            getComponent={() => require("../screens/InfoScreen").default}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
