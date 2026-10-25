import { type ReactNode } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text as NativeText,
} from "react-native";
import { Image } from "expo-image";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { Screen, Title, IconButton } from "./ui";
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
                height: greeting ? 174 : 112,
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              {greeting ? (
                <View
                  style={{
                    width: "100%",
                    height: 174,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "flex-end",
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      maxWidth: 220,
                      marginTop: 34,
                      marginRight: 8,
                      position: "relative",
                    }}
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: palette.line,
                        borderRadius: 19,
                        paddingHorizontal: 15,
                        paddingVertical: 12,
                        backgroundColor: palette.panel,
                      }}
                    >
                      <NativeText
                        style={{
                          color: palette.ink,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 17,
                          lineHeight: 23,
                        }}
                        numberOfLines={3}
                      >
                        {greeting}
                      </NativeText>
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        right: -28,
                        top: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      {[7, 5, 3].map((size) => (
                        <View
                          key={size}
                          style={{
                            width: size,
                            height: size,
                            borderRadius: size,
                            borderWidth: 1,
                            borderColor: palette.line,
                            backgroundColor: palette.panel,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  <Image
                    source={require("../../assets/scholar/67.webp")}
                    accessibilityLabel="Scholar says hello"
                    style={{ width: 112, height: 168 }}
                    contentFit="contain"
                  />
                </View>
              ) : (
                <Scholar
                  state={state}
                  width={110}
                  sceneWidth={112}
                  sceneHeight={120}
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
