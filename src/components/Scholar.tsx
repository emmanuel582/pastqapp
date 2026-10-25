import React, { memo, useContext, useEffect, useState } from "react";
import { View, AppState, Pressable } from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { Image } from "expo-image";
import { useApp } from "../state/AppContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
import {
  scholarMotion,
  type ScholarState,
  type ScholarFrame,
} from "../domain/scholarMotion";
import {
  createScholarPlayer,
  openingScholarTurn,
  scholarBlend,
} from "../domain/scholarPlayback";
import { acquireScholarFrames, type ScholarImages } from "./scholarFrames";
import { poses } from "../data/poses";
const still: Record<ScholarState, [number, number]> = {
  idle: [0, 0],
  study: [8, 1],
  thinking: [7, 0],
  waiting: [6, 2],
  encourage: [5, 5],
  celebrate: [8, 5],
};
const jumpFrames = [
  require("../../assets/scholar/actions/jump-0.webp"),
  require("../../assets/scholar/actions/jump-1.webp"),
  require("../../assets/scholar/actions/jump-2.webp"),
  require("../../assets/scholar/actions/jump-3.webp"),
  require("../../assets/scholar/actions/jump-4.webp"),
];
const jumpHolds = [180, 100, 180, 100, 420];
function stillPose(state: ScholarState): ScholarFrame {
  return {
    row: still[state][0],
    frame: still[state][1],
    hold: 0,
    blend: 0,
    action: "still",
  };
}
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
  const navigation = useContext(NavigationContext);
  const [pose, setPose] = useState(() =>
    animated
      ? scholarMotion(state, openingScholarTurn(state))[0]
      : stillPose(state),
  );
  const [images, setImages] = useState<ScholarImages | null>(null);
  const [jumpFrame, setJumpFrame] = useState<number | null>(null);
  useEffect(() => {
    if (jumpFrame === null) return;
    const timer = setTimeout(() => setJumpFrame(frame => frame === null || frame >= jumpFrames.length - 1 ? null : frame + 1), jumpHolds[jumpFrame]);
    return () => clearTimeout(timer);
  }, [jumpFrame]);
  useEffect(() => {
    if (!animated) {
      setImages(null);
      return;
    }
    let alive = true;
    const cache = acquireScholarFrames();
    void cache.ready.then((value) => {
      if (alive) setImages(value);
    });
    return () => {
      alive = false;
      cache.release();
    };
  }, [animated]);
  useEffect(() => {
    if (!animated || reduced) {
      setPose(stillPose(state));
      return;
    }
    if (!images) {
      setPose(scholarMotion(state, openingScholarTurn(state))[0]);
      return;
    }
    const player = createScholarPlayer(state, setPose);
    const visibility = () => {
      if (
        AppState.currentState === "active" &&
        (navigation?.isFocused() ?? true)
      )
        player.resume();
      else player.pause();
    };
    const app = AppState.addEventListener("change", visibility);
    const focus = navigation?.addListener("focus", visibility);
    const blur = navigation?.addListener("blur", visibility);
    visibility();
    return () => {
      player.dispose();
      app.remove();
      focus?.();
      blur?.();
    };
  }, [state, animated, reduced, images, navigation]);
  const height = (width * 208) / 192,
    key = pose.row + "-" + pose.frame;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tap Scholar to see him jump"
      onPress={() => { if (!reduced && jumpFrame === null) setJumpFrame(0); }}
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
        source={jumpFrame === null ? images?.[key] || poses[key] : jumpFrames[jumpFrame]}
        style={{ width, height }}
        contentFit="contain"
        transition={reduced || jumpFrame !== null ? 0 : scholarBlend(pose)}
        cachePolicy="memory"
      />
    </Pressable>
  );
});
