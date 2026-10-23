import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Move from "lucide-react-native/icons/move";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import X from "lucide-react-native/icons/x";
import { Calculator } from "./StudyTools";
import { IconButton, Text } from "./ui";
import { useApp } from "../state/AppContext";
import { fonts } from "../theme/tokens";
import {
  fitTool,
  initialTool,
  moveTool,
  resizeTool,
  type ToolFrame,
} from "../domain/floatingTool";

export default function FloatingCalculator({
  onClose,
  savedFrame,
}: {
  onClose: () => void;
  savedFrame: MutableRefObject<ToolFrame | null>;
}) {
  const { palette } = useApp(),
    insets = useSafeAreaInsets(),
    window = useWindowDimensions();
  const [bounds, setBounds] = useState({
    width: window.width - insets.left - insets.right - 16,
    height: window.height - insets.top - insets.bottom - 16,
  });
  const touchStyle =
    Platform.OS === "web" ? { touchAction: "none" as const } : {};
  const currentBounds = useRef(bounds);
  currentBounds.current = bounds;
  const frame = useRef(
    fitTool(savedFrame.current || initialTool(bounds), bounds),
  );
  const start = useRef(frame.current);
  const position = useRef(
    new Animated.ValueXY({ x: frame.current.x, y: frame.current.y }),
  ).current;
  const size = useRef(
    new Animated.ValueXY({ x: frame.current.width, y: frame.current.height }),
  ).current;
  // Animated values update the panel directly; dragging never renders the exam or keypad per frame.
  function apply(next: ToolFrame) {
    const previous = frame.current;
    frame.current = next;
    position.setValue({ x: next.x, y: next.y });
    if (next.width !== previous.width || next.height !== previous.height) {
      size.setValue({ x: next.width, y: next.height });
    }
    savedFrame.current = next;
  }
  useEffect(() => {
    apply(fitTool(frame.current, bounds));
  }, [bounds.width, bounds.height]);
  const responders = useMemo(() => {
    const make = (resize: boolean) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) + Math.abs(g.dy) > 2,
        onPanResponderGrant: (event) => {
          if (Platform.OS === "web") event.preventDefault();
          start.current = { ...frame.current };
        },
        onPanResponderMove: (_, g) => {
          apply(
            (resize ? resizeTool : moveTool)(
              start.current,
              g.dx,
              g.dy,
              currentBounds.current,
            ),
          );
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      });
    return { move: make(false), resize: make(true) };
  }, [position, size, savedFrame]);
  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 10,
          top: insets.top + 8,
          bottom: insets.bottom + 8,
          left: insets.left + 8,
          right: insets.right + 8,
        },
      ]}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width > 0 && layout.height > 0)
          setBounds((prev) =>
            prev.width === layout.width && prev.height === layout.height
              ? prev
              : { width: layout.width, height: layout.height },
          );
      }}
    >
      <Animated.View
        testID="floating-calculator"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size.x,
          height: size.y,
          transform: position.getTranslateTransform(),
          backgroundColor: palette.panel,
          borderColor: palette.line,
          borderWidth: 1,
          borderRadius: 12,
          overflow: "hidden",
          elevation: 12,
          boxShadow: "0px 6px 24px rgba(0,0,0,0.22)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderColor: palette.line,
          }}
        >
          <View
            {...responders.move.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Move calculator"
            accessibilityHint="Drag this title bar to move the calculator."
            accessibilityActions={[
              { name: "left", label: "Move left" },
              { name: "right", label: "Move right" },
              { name: "up", label: "Move up" },
              { name: "down", label: "Move down" },
            ]}
            onAccessibilityAction={({ nativeEvent: { actionName } }) =>
              apply(
                moveTool(
                  frame.current,
                  actionName === "left" ? -24 : actionName === "right" ? 24 : 0,
                  actionName === "up" ? -24 : actionName === "down" ? 24 : 0,
                  currentBounds.current,
                ),
              )
            }
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 12,
              height: 44,
              ...touchStyle,
            }}
          >
            <Move size={15} color={palette.muted} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
              Calculator
            </Text>
          </View>
          <IconButton
            label="Reset calculator size and position"
            onPress={() => apply(initialTool(currentBounds.current))}
            style={{ width: 44, height: 44 }}
          >
            <RotateCcw size={15} color={palette.muted} />
          </IconButton>
          <IconButton
            label="Close calculator"
            onPress={onClose}
            style={{ width: 44, height: 44 }}
          >
            <X size={18} color={palette.muted} />
          </IconButton>
        </View>
        <Calculator />
        <View
          style={{
            height: 32,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Text style={{ fontSize: 10, color: palette.muted, marginRight: 4 }}>
            Resize
          </Text>
          <View
            {...responders.resize.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Resize calculator"
            accessibilityHint="Drag this bottom corner to change the calculator size."
            accessibilityActions={[
              { name: "increment", label: "Larger" },
              { name: "decrement", label: "Smaller" },
            ]}
            onAccessibilityAction={({ nativeEvent: { actionName } }) => {
              const delta = actionName === "increment" ? 24 : -24;
              apply(
                resizeTool(frame.current, delta, delta, currentBounds.current),
              );
            }}
            style={{
              width: 44,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              ...touchStyle,
            }}
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRightWidth: 2,
                borderBottomWidth: 2,
                borderColor: palette.muted,
              }}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
