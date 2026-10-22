import React, { memo, useEffect, useRef, useState } from "react";
import { View, AppState } from "react-native";
import Clock3 from "lucide-react-native/icons/clock-3";
import { useApp } from "../state/AppContext";
import { Text } from "./ui";
import { fonts } from "../theme/tokens";
export const formatTime = (seconds: number) =>
  Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0") +
  ":" +
  (seconds % 60).toString().padStart(2, "0");
export default memo(function ExamClock({
  deadline,
  duration,
  onExpire,
}: {
  deadline: number;
  duration: number;
  onExpire: () => void;
}) {
  const { palette } = useApp();
  const [remaining, setRemaining] = useState(() =>
      Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    ),
    callback = useRef(onExpire),
    expired = useRef(false);
  callback.current = onExpire;
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const n = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(n);
      if (!n && !expired.current) {
        expired.current = true;
        callback.current();
      }
    };
    function resume(state: string) {
      clearInterval(interval);
      if (state === "active") {
        tick();
        interval = setInterval(tick, 500);
      }
    }
    resume(AppState.currentState || "active");
    const sub = AppState.addEventListener("change", resume);
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [deadline]);
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={"Time remaining " + formatTime(remaining)}
      style={{
        flexDirection: "row",
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 10,
        alignItems: "center",
        borderWidth: 1,
        borderColor:
          remaining <= duration * 0.1 ? palette.accent : palette.line,
        borderRadius: 5,
        backgroundColor: palette.timer,
      }}
    >
      <Clock3 size={14} color={palette.accent} />
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 14,
          color: remaining <= duration * 0.1 ? palette.accent : palette.ink,
        }}
      >
        {formatTime(remaining)}
      </Text>
    </View>
  );
});
