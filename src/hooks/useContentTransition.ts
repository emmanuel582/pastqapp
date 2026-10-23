import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Animated, Easing, Platform } from "react-native";
import { useReducedMotion } from "./useReducedMotion";
/** Finish the old view before moving the next one in; never animate layout or block local reads. */
export function useContentTransition() {
  const opacity = useRef(new Animated.Value(1)).current,
    y = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion(),
    live = useRef(true),
    busy = useRef(false),
    generation = useRef(0),
    frame = useRef<number | undefined>(undefined);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
      opacity.stopAnimation();
      y.stopAnimation();
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [opacity, y]);
  const [committed, setCommitted] = useState<{
    id: number;
    direction: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!committed || !live.current || committed.id !== generation.current)
      return;
    y.setValue(10 * committed.direction);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (!live.current || committed.id !== generation.current) return;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(() => {
        busy.current = false;
      });
    });
  }, [committed, opacity, y]);
  const transition = useCallback(
    (commit: () => void, direction = 1) => {
      if (busy.current) return;
      if (reduced) {
        commit();
        return;
      }
      busy.current = true;
      const id = ++generation.current;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 85,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(y, {
          toValue: -4 * direction,
          duration: 85,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(({ finished }) => {
        if (!finished || !live.current || id !== generation.current) {
          busy.current = false;
          return;
        }
        commit();
        setCommitted({ id, direction });
      });
    },
    [opacity, y, reduced],
  );
  return { transition, style: { opacity, transform: [{ translateY: y }] } };
}
