import React, { useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import X from "lucide-react-native/icons/x";
import { useApp } from "../state/AppContext";
import { Text, Muted, IconButton } from "./ui";
import { calculate } from "../domain/examSession";
import { fonts } from "../theme/tokens";
const keys = [
  "AC",
  "DEL",
  "÷",
  "×",
  "7",
  "8",
  "9",
  "−",
  "4",
  "5",
  "6",
  "+",
  "1",
  "2",
  "3",
  "=",
  "(",
  "0",
  ".",
  ")",
];
export function Calculator({
  onClose,
  side = false,
}: {
  onClose: () => void;
  side?: boolean;
}) {
  const { palette } = useApp(),
    { height } = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const [expression, setExpression] = useState(""),
    [result, setResult] = useState("0"),
    [error, setError] = useState(""),
    [evaluated, setEvaluated] = useState(false);
  function press(key: string) {
    setError("");
    if (key === "AC") {
      setExpression("");
      setResult("0");
      setEvaluated(false);
      return;
    }
    if (key === "DEL") {
      setExpression((v) => v.slice(0, -1));
      setEvaluated(false);
      return;
    }
    if (key === "=") {
      try {
        setResult(calculate(expression || result));
        setEvaluated(true);
      } catch {
        setError("Check your calculation");
      }
      return;
    }
    const operator = /^[+−×÷]$/.test(key);
    setExpression((v) =>
      ((evaluated ? (operator ? result : "") : v) + key).slice(0, 512),
    );
    setEvaluated(false);
  }
  return (
    <View
      style={{
        height: side ? "100%" : Math.min(350, Math.max(240, height * 0.43)),
        width: side ? 320 : undefined,
        paddingHorizontal: 16,
        paddingBottom: Math.max(8, insets.bottom),
        borderTopWidth: 1,
        borderColor: palette.line,
        backgroundColor: palette.panel,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", height: 38 }}>
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, flex: 1 }}>
          Calculator
        </Text>
        <IconButton
          label="Close calculator"
          onPress={onClose}
          style={{ width: 44, height: 38 }}
        >
          <X size={18} color={palette.muted} />
        </IconButton>
      </View>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          backgroundColor: palette.timer,
          borderRadius: 6,
          marginBottom: 6,
        }}
      >
        <Text
          numberOfLines={1}
          accessibilityLabel="Calculator expression"
          style={{ textAlign: "right", fontFamily: fonts.mono, fontSize: 12 }}
        >
          {expression || "0"}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLiveRegion="polite"
          style={{
            textAlign: "right",
            fontFamily: fonts.mono,
            fontSize: error ? 13 : 22,
            lineHeight: 28,
          }}
        >
          {error || result}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {Array.from({ length: 5 }, (_, row) => (
          <View key={row} style={{ flexDirection: "row", flex: 1, gap: 5 }}>
            {keys.slice(row * 4, row * 4 + 4).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={
                  key === "DEL"
                    ? "Delete last digit"
                    : key === "AC"
                      ? "Clear calculator"
                      : key === "="
                        ? "Equals"
                        : key
                }
                onPress={() => press(key)}
                style={({ pressed }) => ({
                  flex: 1,
                  borderWidth: 1,
                  borderColor: palette.line,
                  borderRadius: 6,
                  backgroundColor: key === "=" ? palette.button : palette.wash,
                  opacity: pressed ? 0.65 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: key === "=" ? palette.onButton : palette.ink,
                  }}
                >
                  {key === "DEL" ? "⌫" : key}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
export { default as DrawingBoard } from "./DrawingBoard";
