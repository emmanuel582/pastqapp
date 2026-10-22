import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, PanResponder, Platform } from "react-native";
import {
  horizontalQuestionIntent,
  questionSwipeDirection,
} from "../domain/swipe";
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
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          current.current.enabled &&
          horizontalQuestionIntent(
            gesture.dx,
            gesture.dy,
            gesture.numberActiveTouches,
          ),
        onPanResponderGrant: () => {
          startedOn.current = current.current.questionKey;
          multiTouch.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          if (gesture.numberActiveTouches > 1) multiTouch.current = true;
        },
        onPanResponderRelease: (_, gesture) => {
          const next = questionSwipeDirection(
            gesture.dx,
            gesture.dy,
            gesture.vx,
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
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderTerminate: () => {
          multiTouch.current = true;
        },
      }),
    [],
  );
  useEffect(() => {
    if (previous.current === questionKey) return;
    previous.current = questionKey;
    x.stopAnimation();
    opacity.stopAnimation();
    if (reduced) {
      x.setValue(0);
      opacity.setValue(1);
      return;
    }
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
    <Animated.View
      {...pan.panHandlers}
      style={{ flex: 1, minHeight: 0, opacity, transform: [{ translateX: x }] }}
    >
      {children}
    </Animated.View>
  );
}
