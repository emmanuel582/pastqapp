import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, Platform } from "react-native";
import { questionSwipeDirection } from "../domain/swipe";
import { useReducedMotion } from "../hooks/useReducedMotion";

export default function QuestionSwipeSurface({
  children,
  questionKey,
  enabled,
  onSwipe,
}: {
  children: ReactNode;
  questionKey: string;
  enabled: boolean;
  onSwipe: (direction: -1 | 1) => void;
}) {
  const current = useRef({ enabled, onSwipe, questionKey });
  current.current = { enabled, onSwipe, questionKey };
  const startedOn = useRef(questionKey),
    multiTouch = useRef(false),
    lastSwipe = useRef(0);
  const direction = useRef(1),
    previous = useRef(questionKey);
  const x = useRef(new Animated.Value(0)).current,
    opacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(() => {
    const gesture = Gesture.Pan()
      .enabled(enabled)
      .runOnJS(true)
      .maxPointers(1)
      .activeOffsetX([-14, 14])
      .failOffsetY([-12, 12])
      .shouldCancelWhenOutside(false)
      .onStart(() => {
        startedOn.current = current.current.questionKey;
        multiTouch.current = false;
      })
      .onUpdate((event) => {
        if (event.numberOfPointers > 1) multiTouch.current = true;
      })
      .onEnd((event, success) => {
        if (!success) return;
        const next = questionSwipeDirection(
          event.translationX,
          event.translationY,
          event.velocityX / 1000,
        );
        if (
          !next ||
          multiTouch.current ||
          !current.current.enabled ||
          startedOn.current !== current.current.questionKey ||
          Date.now() - lastSwipe.current < 250
        )
          return;
        lastSwipe.current = Date.now();
        direction.current = next;
        current.current.onSwipe(next);
      });
    if (Platform.OS !== "web")
      gesture.simultaneousWithExternalGesture(scrollGesture);
    return gesture;
  }, [scrollGesture, enabled]);
  useEffect(() => {
    if (reduced) {
      x.stopAnimation();
      opacity.stopAnimation();
      x.setValue(0);
      opacity.setValue(1);
      previous.current = questionKey;
      return;
    }
    if (previous.current === questionKey) return;
    previous.current = questionKey;
    x.stopAnimation();
    opacity.stopAnimation();
    x.setValue(direction.current * 12);
    opacity.setValue(0.65);
    const animation = Animated.parallel([
      Animated.timing(x, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [questionKey, reduced, x, opacity]);
  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Animated.View
        style={{
          flex: 1,
          minHeight: 0,
          opacity,
          transform: [{ translateX: x }],
        }}
      >
        {Platform.OS === "web" ? (
          children
        ) : (
          <GestureDetector gesture={scrollGesture}>{children}</GestureDetector>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
