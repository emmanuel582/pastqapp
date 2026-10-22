import React from "react";
import Svg, { Rect, G, Path, Circle } from "react-native-svg";
import { useApp } from "../state/AppContext";
export default function PaperArt() {
  const { palette: p } = useApp();
  return (
    <Svg width={120} height={112} viewBox="0 0 180 168" fill="none">
      <Rect
        x={40}
        y={26}
        width={100}
        height={126}
        rx={4}
        transform="rotate(-10 40 26)"
        fill={p.control}
        stroke={p.line}
      />
      <Rect
        x={57}
        y={13}
        width={100}
        height={132}
        rx={4}
        transform="rotate(6 57 13)"
        fill={p.bg}
        stroke={p.artInk}
        strokeOpacity={0.5}
      />
      <G transform="rotate(6 57 13)">
        <Path
          d="M74 36h47"
          stroke={p.ink}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M74 47h30M74 66h65M74 73h51M74 99h65M74 106h45"
          stroke={p.artInk}
          strokeOpacity={0.4}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Circle cx={78} cy={85} r={3} stroke={p.artInk} strokeOpacity={0.5} />
        <Circle cx={93} cy={85} r={3} stroke={p.accent} />
        <Path
          d="M78 120h45"
          stroke={p.artInk}
          strokeOpacity={0.35}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </G>
      <Path
        d="m26 128 21 21 45-47"
        stroke={p.accent}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
