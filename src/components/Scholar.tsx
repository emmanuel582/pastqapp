import React, { memo, useEffect, useState } from "react";
import { View, AppState } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state/AppContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
import {
  scholarMotion,
  type ScholarState,
  type ScholarFrame,
} from "../domain/scholarMotion";
import { poses } from "../data/poses";
const still: Record<ScholarState, [number, number]> = {
  idle: [0, 0],
  study: [8, 1],
  thinking: [7, 0],
  waiting: [6, 2],
  encourage: [5, 5],
  celebrate: [8, 5],
};
export default memo(function Scholar({
  state = "study",
  width = 168,
  sceneWidth,
  sceneHeight,
  animated = false,
}: {
  state?: ScholarState;
  width?: number;
  sceneWidth?: number;
  sceneHeight?: number;
  animated?: boolean;
}) {
  const { palette } = useApp(),
    reduced = useReducedMotion();
  const [pose, setPose] = useState<ScholarFrame>({
    row: still[state][0],
    frame: still[state][1],
    hold: 0,
    blend: 380,
    action: "still",
  });
  useEffect(() => {
    if (!animated || reduced) {
      setPose({
        row: still[state][0],
        frame: still[state][1],
        hold: 0,
        blend: 380,
        action: "still",
      });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let turn = state === "waiting" || state === "encourage" ? 1 : 0,
      index = 0,
      sequence = scholarMotion(state, turn),
      stopped = false;
    function show() {
      clearTimeout(timer);
      if (stopped || AppState.currentState !== "active") return;
      setPose(sequence[index]);
      timer = setTimeout(() => {
        index++;
        if (index >= sequence.length) {
          if (state === "celebrate") {
            setPose({ row: 8, frame: 5, hold: 0, blend: 160, action: "smile" });
            return;
          }
          sequence = scholarMotion(state, ++turn);
          index = 0;
        }
        show();
      }, sequence[index].hold);
    }
    show();
    const sub = AppState.addEventListener("change", (state) => {
      clearTimeout(timer);
      if (state === "active") show();
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [state, animated, reduced]);
  const height = (width * 208) / 192;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: sceneWidth || width + 12,
        height: sceneHeight || height + 8,
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 4,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: width * 0.36,
          height: 4,
          bottom: 3,
          borderRadius: 50,
          backgroundColor: palette.line,
        }}
      />
      <Image
        source={poses[pose.row + "-" + pose.frame]}
        style={{ width, height }}
        contentFit="contain"
        transition={reduced ? 0 : pose.blend}
        cachePolicy="memory-disk"
      />
    </View>
  );
});
