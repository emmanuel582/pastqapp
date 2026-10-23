import React, { useMemo, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import Grip from "lucide-react-native/icons/grip";
import X from "lucide-react-native/icons/x";
import { useApp } from "../state/AppContext";
import { Text, Muted, IconButton } from "./ui";
import { calculate, fitTool } from "../domain/examSession";
import { fonts } from "../theme/tokens";
export function Calculator({ onClose }: { onClose: () => void }) {
  const { palette } = useApp(),
    bounds = useWindowDimensions();
  const [rect, setRect] = useState(() =>
      fitTool(
        {
          x: bounds.width - 340,
          y: 100,
          width: 324,
          height: Math.min(560, bounds.height - 130),
        },
        bounds,
      ),
    ),
    [expression, setExpression] = useState(""),
    [result, setResult] = useState("0"),
    [error, setError] = useState(""),
    [evaluated, setEvaluated] = useState(false),
    start = useRef(rect),
    current = useRef(rect);
  current.current = rect;
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = current.current;
        },
        onPanResponderMove: (_, g) =>
          setRect(
            fitTool(
              {
                ...start.current,
                x: start.current.x + g.dx,
                y: start.current.y + g.dy,
              },
              bounds,
            ),
          ),
      }),
    [bounds.width, bounds.height],
  );
  function press(key: string) {
    setError("");
    if (key === "AC") {
      setExpression("");
      setResult("0");
      setEvaluated(false);
      return;
    }
    if (key === "DEL") {
      setExpression((v) => v.slice(0, -1));
      setEvaluated(false);
      return;
    }
    if (key === "=") {
      try {
        setResult(calculate(expression || result));
        setEvaluated(true);
      } catch {
        setError("Check your expression");
      }
      return;
    }
    const operator = /^[+−×÷^%]$/.test(key);
    setExpression((v) => (evaluated ? (operator ? result : "") : v) + key);
    setEvaluated(false);
  }
  const keys = [
    "AC",
    "DEL",
    "(",
    ")",
    "sin(",
    "cos(",
    "sqrt(",
    "^",
    "7",
    "8",
    "9",
    "÷",
    "4",
    "5",
    "6",
    "×",
    "1",
    "2",
    "3",
    "−",
    ".",
    "0",
    "%",
    "+",
  ];
  return (
    <View
      style={{
        position: "absolute",
        zIndex: 40,
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        padding: 12,
        borderWidth: 1,
        borderColor: palette.line,
        borderRadius: 8,
        backgroundColor: palette.panel,
        boxShadow: "0 20px 80px #00000060",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 36,
        }}
      >
        <View
          {...drag.panHandlers}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Grip size={17} color={palette.muted} />
          <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
            Calculator
          </Text>
          <Muted style={{ fontSize: 9 }}>Drag to move</Muted>
        </View>
        <IconButton
          label="Close calculator"
          onPress={onClose}
          style={{ width: 34, height: 36 }}
        >
          <X size={18} color={palette.muted} />
        </IconButton>
      </View>
      <View
        style={{
          padding: 10,
          backgroundColor: palette.timer,
          marginVertical: 12,
          borderWidth: 1,
          borderColor: palette.line,
          borderRadius: 4,
        }}
      >
        <Muted style={{ fontSize: 8, letterSpacing: 1 }}>
          EXPRESSION · DEGREES
        </Muted>
        <TextInput
          value={expression}
          onChangeText={(v) => {
            setExpression(v);
            setEvaluated(false);
          }}
          accessibilityLabel="Calculator expression"
          placeholder="0"
          placeholderTextColor={palette.muted}
          style={{
            fontFamily: fonts.mono,
            color: palette.ink,
            fontSize: 16,
            textAlign: "right",
            marginTop: 8,
            padding: 0,
          }}
        />
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: 24,
            lineHeight: 34,
            textAlign: "right",
            marginTop: 5,
          }}
        >
          {error || result}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        {Array.from({ length: 6 }, (_, row) => (
          <View key={row} style={{ flexDirection: "row", flex: 1, gap: 5 }}>
            {keys.slice(row * 4, row * 4 + 4).map((key) => (
              <Pressable
                key={key}
                onPress={() => press(key)}
                style={{
                  flex: 1,
                  minHeight: 24,
                  borderWidth: 1,
                  borderColor: palette.line,
                  borderRadius: 4,
                  backgroundColor: palette.wash,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 12 }}>
                  {key
                    .replace("sqrt(", "√")
                    .replace("(", key === "(" ? "(" : "")}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
        <Pressable
          onPress={() => press("=")}
          style={{
            flex: 1,
            minHeight: 24,
            borderRadius: 4,
            backgroundColor: palette.button,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: palette.onButton, fontFamily: fonts.bold }}>
            =
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
export { default as DrawingBoard } from "./DrawingBoard";
