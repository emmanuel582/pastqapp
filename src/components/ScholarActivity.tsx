import React, { useEffect, useMemo, useState } from "react";
import { AppState, Pressable } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "../hooks/useReducedMotion";

export type ScholarActivityMode = "six-seven" | "upload" | "download" | "processing";
type Step = { source: number; hold: number };

const sixSeven = [
  require("../../assets/scholar/actions/six-seven-0.webp"),
  require("../../assets/scholar/actions/six-seven-1.webp"),
  require("../../assets/scholar/actions/six-seven-2.webp"),
  require("../../assets/scholar/actions/six-seven-3.webp"),
  require("../../assets/scholar/actions/six-seven-4.webp"),
  require("../../assets/scholar/actions/six-seven-5.webp"),
];
const alarm = [
  require("../../assets/scholar/actions/alarm-urgency-0.webp"),
  require("../../assets/scholar/actions/alarm-urgency-1.webp"),
  require("../../assets/scholar/actions/alarm-urgency-2.webp"),
  require("../../assets/scholar/actions/alarm-urgency-3.webp"),
  require("../../assets/scholar/actions/alarm-urgency-4.webp"),
  require("../../assets/scholar/actions/alarm-urgency-5.webp"),
];
const study = [
  require("../../assets/scholar/actions/book-study-0.webp"),
  require("../../assets/scholar/actions/book-study-1.webp"),
  require("../../assets/scholar/actions/book-study-2.webp"),
  require("../../assets/scholar/actions/book-study-3.webp"),
  require("../../assets/scholar/actions/book-study-4.webp"),
  require("../../assets/scholar/actions/book-study-5.webp"),
];
const jump = [
  require("../../assets/scholar/actions/jump-0.webp"),
  require("../../assets/scholar/actions/jump-1.webp"),
  require("../../assets/scholar/actions/jump-2.webp"),
  require("../../assets/scholar/actions/jump-3.webp"),
  require("../../assets/scholar/actions/jump-4.webp"),
];
const run = [
  require("../../assets/scholar/actions/run-0.webp"),
  require("../../assets/scholar/actions/run-1.webp"),
  require("../../assets/scholar/actions/run-2.webp"),
  require("../../assets/scholar/actions/run-3.webp"),
  require("../../assets/scholar/actions/run-4.webp"),
  require("../../assets/scholar/actions/run-5.webp"),
];
const wait = [
  require("../../assets/scholar/actions/wait-0.webp"),
  require("../../assets/scholar/actions/wait-1.webp"),
  require("../../assets/scholar/actions/wait-2.webp"),
  require("../../assets/scholar/actions/wait-3.webp"),
  require("../../assets/scholar/actions/wait-4.webp"),
  require("../../assets/scholar/actions/wait-5.webp"),
];

const sequence = (sources: number[], holds: number | number[]): Step[] =>
  sources.map((source, index) => ({ source, hold: typeof holds === "number" ? holds : holds[index] }));
const studySteps = sequence(study, [350, 280, 500, 280, 500, 700]);
const waitSteps = sequence(wait, [450, 220, 420, 300, 350, 700]);
const plans: Record<ScholarActivityMode | "jump", Step[]> = {
  "six-seven": sequence(sixSeven, 130),
  upload: [
    ...sequence(alarm, 120),
    ...sequence(run, [500, 400, 500, 240, 500, 800]),
    ...studySteps,
    ...waitSteps,
    ...studySteps,
  ],
  download: [
    ...studySteps,
    ...sequence(run, [500, 400, 500, 240, 500, 800]),
    ...studySteps,
    ...waitSteps,
  ],
  processing: [...studySteps, ...sequence(wait, 340), ...studySteps, ...waitSteps],
  jump: sequence(jump, [180, 100, 180, 100, 420]),
};

export default function ScholarActivity({ mode, height, width }: {
  mode: ScholarActivityMode;
  height: number;
  width?: number;
}) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(true);
  const [jumping, setJumping] = useState(false);
  const [index, setIndex] = useState(0);
  const plan = plans[jumping ? "jump" : mode];
  const frameWidth = width ?? (height * 192) / 208;
  const source = useMemo(() => plan[Math.min(index, plan.length - 1)].source, [plan, index]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    setIndex(0);
  }, [mode, jumping]);
  useEffect(() => {
    if (reduced || !active) return;
    const timer = setTimeout(() => {
      if (jumping && index === plan.length - 1) setJumping(false);
      else setIndex(current => (current + 1) % plan.length);
    }, plan[Math.min(index, plan.length - 1)].hold);
    return () => clearTimeout(timer);
  }, [active, index, jumping, plan, reduced]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tap Scholar to see him jump"
      onPress={() => { if (!reduced && !jumping) setJumping(true); }}
      style={{ width: frameWidth, height, alignItems: "center", justifyContent: "flex-end" }}
    >
      <Image
        source={source}
        style={{ width: frameWidth, height }}
        contentFit="contain"
        transition={0}
        cachePolicy="memory"
      />
    </Pressable>
  );
}
