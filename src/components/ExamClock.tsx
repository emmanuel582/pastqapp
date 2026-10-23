import React, { memo, useEffect, useRef, useState } from "react";
import { View, AppState, Animated, Platform } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useApp } from "../state/AppContext";
import { Text } from "./ui";
import { fonts } from "../theme/tokens";
import { examCountdown, formatTime } from "../domain/examClock";
export { formatTime } from "../domain/examClock";
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
  );
  const callback = useRef(onExpire);
  callback.current = onExpire;
  const angle = Math.max(0, duration - remaining) * 6;
  const hand = useRef(new Animated.Value(angle)).current,
    last = useRef(angle);
  useEffect(() => {
    if (angle - last.current === 6) {
      const animation = Animated.timing(hand, {
        toValue: angle,
        duration: 140,
        useNativeDriver: Platform.OS !== "web",
      });
      animation.start();
      last.current = angle;
      return () => animation.stop();
    }
    hand.setValue(angle);
    last.current = angle;
  }, [angle, hand]);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = examCountdown(deadline, setRemaining, () =>
      callback.current(),
    );
    function resume(state: string) {
      clearInterval(interval);
      if (state === "active") {
        tick();
        interval = setInterval(tick, 1000);
      }
    }
    resume(AppState.currentState || "active");
    const sub = AppState.addEventListener("change", resume);
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [deadline]);
  const urgent = remaining <= Math.min(300, duration * 0.1),
    color = urgent ? palette.incorrect : palette.ink;
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={"Time remaining " + formatTime(remaining)}
      style={{
        flexDirection: "row",
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 10,
        alignItems: "center",
        borderWidth: 1,
        borderColor: urgent ? palette.incorrect : palette.line,
        borderRadius: 5,
        backgroundColor: palette.timer,
      }}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ width: 18, height: 18 }}
      >
        <Svg width={18} height={18}>
          <Circle
            cx={9}
            cy={9}
            r={7.5}
            fill="none"
            stroke={palette.muted}
            strokeWidth={1}
          />
          <Line
            x1={9}
            y1={9}
            x2={5.5}
            y2={8}
            stroke={palette.muted}
            strokeWidth={1.3}
          />
        </Svg>
        <Animated.View
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            transform: [
              {
                rotate: hand.interpolate({
                  inputRange: [0, 360],
                  outputRange: ["0deg", "360deg"],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 1.5,
              height: 6.5,
              left: 8.25,
              top: 2.5,
              backgroundColor: urgent ? palette.incorrect : palette.accent,
              borderRadius: 1,
            }}
          />
        </Animated.View>
      </View>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 14,
          color,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatTime(remaining)}
      </Text>
    </View>
  );
});
