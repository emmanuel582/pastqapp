import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { AppProvider } from "./src/state/AppContext";
import RootNavigator from "./src/navigation/RootNavigator";
void SplashScreen.preventAutoHideAsync().catch(() => {});
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <View style={styles.loading}>
          <Text style={{ color: "#eee9e1", fontSize: 20 }}>
            focalPoint could not open this screen.
          </Text>
          <Text style={{ color: "#aaa49b", padding: 24 }}>
            {__DEV__
              ? this.state.error.message
              : "Close and reopen the app to try again. Your saved practice stays on this device."}
          </Text>
        </View>
      );
    return this.props.children;
  }
}
export default function App() {
  const [loaded, error] = useFonts({
    Manrope_400Regular: require("@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf"),
    Manrope_500Medium: require("@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf"),
    Manrope_600SemiBold: require("@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf"),
    Manrope_700Bold: require("@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf"),
    Outfit_400Regular: require("@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf"),
    Outfit_500Medium: require("@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf"),
    Lora_400Regular: require("@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf"),
    Lora_500Medium: require("@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf"),
    JetBrainsMono_400Regular: require("@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf"),
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded)
    return (
      <View style={styles.loading}>
        {error ? (
          <Text style={{ color: "#eee9e1" }}>
            The bundled fonts could not load. Reopen focalPoint to retry.
          </Text>
        ) : (
          <ActivityIndicator color="#c7927d" />
        )}
      </View>
    );
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#151515",
    alignItems: "center",
    justifyContent: "center",
  },
});
