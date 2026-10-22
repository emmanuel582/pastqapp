import React, { useState } from "react";
import { View, Pressable } from "react-native";
import Monitor from "lucide-react-native/icons/monitor";
import Check from "lucide-react-native/icons/check";
import {
  Screen,
  Header,
  Content,
  Text,
  Muted,
  ErrorText,
} from "../components/ui";
import { useApp } from "../state/AppContext";
import { fonts } from "../theme/tokens";
import type { ThemeMode } from "../domain/types";
import type { Props } from "../navigation/types";
export default function ThemeScreen({ navigation }: Props<"Theme">) {
  const { preferences, setPreferences, palette } = useApp(),
    [error, setError] = useState("");
  function choose(theme: ThemeMode) {
    void setPreferences({ ...preferences, theme }).catch(() =>
      setError("Your theme could not be saved."),
    );
  }
  return (
    <Screen>
      <Header title="Theme" onBack={() => navigation.goBack()} />
      <Content style={{ paddingTop: 24 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {(["system", "light", "dark"] as const).map((mode) => {
            const selected = preferences.theme === mode,
              system = mode === "system",
              ink = mode === "light" ? "#2e2a27" : "#eee9e1",
              surface = mode === "light" ? "#fffcf8" : "#202020";
            return (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => choose(mode)}
                style={{
                  width: system ? "100%" : "47%",
                  padding: system ? 12 : 10,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? palette.accent : palette.line,
                  borderRadius: 6,
                  backgroundColor: palette.panel,
                  flexDirection: system ? "row" : "column",
                  gap: system ? 14 : 0,
                  alignItems: system ? "center" : undefined,
                }}
              >
                <View
                  style={
                    system
                      ? {
                          width: 44,
                          height: 44,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: palette.bg,
                          borderRadius: 3,
                        }
                      : {
                          height: 122,
                          paddingVertical: 16,
                          paddingHorizontal: 14,
                          gap: 7,
                          backgroundColor:
                            mode === "light" ? "#faf6f0" : "#151515",
                          borderRadius: 3,
                        }
                  }
                >
                  {system ? (
                    <Monitor size={34} color={palette.soft} strokeWidth={1.3} />
                  ) : (
                    <>
                      <View
                        style={{
                          width: "64%",
                          height: 7,
                          backgroundColor: ink,
                          opacity: 0.8,
                        }}
                      />
                      <View
                        style={{
                          width: "40%",
                          height: 4,
                          backgroundColor: ink,
                          opacity: 0.3,
                        }}
                      />
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: surface,
                          borderWidth: 1,
                          borderColor:
                            mode === "light" ? "#eadfd3" : "#ffffff20",
                          marginTop: 5,
                          padding: 10,
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            width: "72%",
                            height: 3,
                            backgroundColor: ink,
                            opacity: 0.3,
                          }}
                        />
                        <View
                          style={{
                            width: "48%",
                            height: 3,
                            backgroundColor: ink,
                            opacity: 0.3,
                          }}
                        />
                        <View
                          style={{
                            width: "40%",
                            height: 9,
                            backgroundColor:
                              mode === "light" ? "#e67468" : "#c7927d",
                            borderRadius: 2,
                            marginTop: 2,
                          }}
                        />
                      </View>
                    </>
                  )}
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: system ? 0 : 12,
                    paddingHorizontal: 3,
                    paddingBottom: 3,
                    flex: system ? 1 : undefined,
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: fonts.semibold }}>
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </Text>
                  <View
                    style={{
                      width: 21,
                      height: 21,
                      borderWidth: 1,
                      borderColor: selected ? palette.accent : palette.line,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected
                        ? palette.accent
                        : "transparent",
                    }}
                  >
                    {selected ? <Check size={13} color={palette.bg} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        {preferences.theme === "system" ? (
          <Muted style={{ marginTop: 14 }}>Follows your device.</Muted>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </Content>
    </Screen>
  );
}
