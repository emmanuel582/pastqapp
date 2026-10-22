import { Platform } from "react-native";
import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useApp } from "../state/AppContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
export default function Skeleton({
  kind = "materials",
}: {
  kind?: "catalog" | "materials" | "sessions";
}) {
  const { palette } = useApp(),
    reduced = useReducedMotion(),
    opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduced]);
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={"Loading " + kind}
      style={{ opacity, paddingTop: 20, gap: 12 }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: kind === "catalog" ? 76 : 72,
            borderWidth: 1,
            borderColor: palette.line,
            borderRadius: kind === "catalog" ? 12 : 6,
            flexDirection: "row",
            gap: 16,
            padding: 14,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 46,
              height: 44,
              borderRadius: 9,
              backgroundColor: palette.control,
            }}
          />
          <View style={{ flex: 1, gap: 10 }}>
            <View
              style={{
                width: i === 1 ? "55%" : "75%",
                height: 10,
                borderRadius: 4,
                backgroundColor: palette.control,
              }}
            />
            <View
              style={{
                width: "40%",
                height: 7,
                borderRadius: 4,
                backgroundColor: palette.control,
              }}
            />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
