import React, { type ReactNode } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Image } from "expo-image";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { Screen, Wordmark, Title, Text, IconButton } from "./ui";
import Scholar from "./Scholar";
import { useApp } from "../state/AppContext";
import type { ScholarState } from "../domain/scholarMotion";
export default function AuthShell({
  title,
  greeting,
  state = "idle",
  onBack,
  children,
}: {
  title: string;
  greeting?: string;
  state?: ScholarState;
  onBack?: () => void;
  children: ReactNode;
}) {
  const { palette } = useApp();
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View
            style={{ paddingTop: 16, paddingBottom: 4, paddingHorizontal: 24 }}
          >
            <Wordmark />
          </View>
          <View
            style={{
              width: "100%",
              maxWidth: 460,
              alignSelf: "center",
              paddingHorizontal: 20,
              gap: 2,
            }}
          >
            <View
              style={{
                height: greeting ? 170 : 112,
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              {greeting ? (
                <View style={{ width: 310, maxWidth: "100%", height: 170 }}>
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 7,
                      width: 148,
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderWidth: 1,
                      borderColor: palette.line,
                      borderRadius: 20,
                      backgroundColor: palette.wash,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_400Regular",
                        fontSize: 19,
                        lineHeight: 24,
                      }}
                    >
                      {greeting}
                    </Text>
                  </View>
                  <Image
                    source={require("../../assets/scholar/67.webp")}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 113.333,
                      height: 170,
                    }}
                    contentFit="contain"
                  />
                </View>
              ) : (
                <Scholar
                  state={state}
                  width={110}
                  sceneWidth={100}
                  sceneHeight={112}
                />
              )}
            </View>
            <View
              style={{
                padding: 24,
                borderWidth: 1,
                borderColor: palette.line,
                borderRadius: 18,
                backgroundColor: palette.panel,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 22,
                }}
              >
                {onBack ? (
                  <IconButton onPress={onBack} label="Go back">
                    <ArrowLeft size={18} color={palette.muted} />
                  </IconButton>
                ) : null}
                <Title size={26} style={{ flex: 1 }}>
                  {title}
                </Title>
              </View>
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
