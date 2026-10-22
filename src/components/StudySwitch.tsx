import { Platform } from "react-native";
import React, { useEffect, useRef } from "react";
import { Pressable, Animated } from "react-native";
import { useApp } from "../state/AppContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
export default function StudySwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const { palette } = useApp(),
    reduced = useReducedMotion(),
    position = useRef(new Animated.Value(checked ? 20 : 0)).current;
  useEffect(() => {
    Animated.timing(position, {
      toValue: checked ? 20 : 0,
      duration: reduced ? 0 : 180,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [checked, reduced]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{
        width: 48,
        height: 28,
        padding: 3,
        borderWidth: 1,
        borderRadius: 18,
        borderColor: checked ? palette.button : palette.line,
        backgroundColor: checked ? palette.button : palette.control,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: checked ? palette.onButton : palette.muted,
          transform: [{ translateX: position }],
        }}
      />
    </Pressable>
  );
}
