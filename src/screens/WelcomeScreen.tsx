import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, Wordmark, Button, Text } from "../components/ui";
import Greeting from "../components/Greeting";
import { useApp } from "../state/AppContext";
import type { Props } from "../navigation/types";
export default function WelcomeScreen({ navigation }: Props<"Welcome">) {
  const { height } = useWindowDimensions(),
    insets = useSafeAreaInsets(),
    { palette } = useApp();
  const compact = height < 600;
  const figureHeight = Math.min(height * (compact ? 0.35 : 0.43), 400);
  return (
    <Screen
      style={{
        paddingTop: Math.max(insets.top, compact ? 12 : 24),
        paddingHorizontal: 24,
        paddingBottom: Math.max(insets.bottom, compact ? 10 : 20),
      }}
    >
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Wordmark />
      </View>
      <View
        style={{
          flex: 1,
          minHeight: figureHeight,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: compact ? 8 : 18,
          paddingBottom: compact ? 14 : 28,
        }}
      >
        <Greeting height={figureHeight} />
      </View>
      <View
        style={{ width: "100%", maxWidth: 360, alignSelf: "center", gap: 8 }}
      >
        <Button
          kind="primary"
          onPress={() => navigation.navigate("Auth", { mode: "signup" })}
          style={{ borderRadius: 12 }}
        >
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Manrope_700Bold",
              color: palette.onButton,
              paddingVertical: 3,
            }}
          >
            Create account
          </Text>
        </Button>
        <Button
          kind="text"
          onPress={() => navigation.navigate("Auth", { mode: "login" })}
        >
          <Text style={{ color: palette.muted, fontSize: 14 }}>Sign in</Text>
        </Button>
      </View>
    </Screen>
  );
}
