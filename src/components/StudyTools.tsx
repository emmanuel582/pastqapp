import React, { useMemo, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import Svg, { Path, Pattern, Defs, Circle, Rect } from "react-native-svg";
import Grip from "lucide-react-native/icons/grip";
import X from "lucide-react-native/icons/x";
import PenLine from "lucide-react-native/icons/pen-line";
import Eraser from "lucide-react-native/icons/eraser";
import Undo2 from "lucide-react-native/icons/undo-2";
import Trash2 from "lucide-react-native/icons/trash";
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
interface Stroke {
  points: { x: number; y: number }[];
  erase: boolean;
  size: number;
}
export function DrawingBoard({
  question,
  onClose,
}: {
  question: string;
  onClose: () => void;
}) {
  const { palette } = useApp();
  const [erase, setErase] = useState(false),
    [revision, setRevision] = useState(0),
    [height, setHeight] = useState(220),
    [layout, setLayout] = useState({ width: 300, height: 120 });
  const notes = useRef(new Map<string, Stroke[]>()),
    active = useRef<Stroke | null>(null),
    frame = useRef<number | undefined>(undefined),
    eraseRef = useRef(erase);
  eraseRef.current = erase;
  const strokes = () => notes.current.get(question) || [];
  const redraw = () => {
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      setRevision((v) => v + 1);
    });
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const stroke = {
            points: [
              {
                x: (event.nativeEvent.locationX / layout.width) * 800,
                y: (event.nativeEvent.locationY / layout.height) * 700,
              },
            ],
            erase: eraseRef.current,
            size: eraseRef.current ? 35 : 3,
          };
          active.current = stroke;
          notes.current.set(question, [...strokes(), stroke]);
          redraw();
        },
        onPanResponderMove: (event) => {
          active.current?.points.push({
            x: (event.nativeEvent.locationX / layout.width) * 800,
            y: (event.nativeEvent.locationY / layout.height) * 700,
          });
          redraw();
        },
        onPanResponderRelease: () => {
          active.current = null;
          redraw();
        },
        onPanResponderTerminate: () => {
          active.current = null;
          redraw();
        },
      }),
    [question, layout.width, layout.height],
  );
  return (
    <View style={{ height, paddingHorizontal: 16, paddingBottom: 10 }}>
      <Pressable
        accessibilityLabel="Resize working paper"
        onPress={() => setHeight((h) => (h === 220 ? 300 : 220))}
        style={{ height: 12, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            width: 40,
            height: 3,
            borderRadius: 2,
            backgroundColor: palette.muted,
          }}
        />
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 37,
        }}
      >
        <PenLine size={18} color={palette.muted} />
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, flex: 1 }}>
          Working paper
        </Text>
        <IconButton
          label="Close working paper"
          onPress={onClose}
          style={{ height: 34, width: 34 }}
        >
          <X size={18} color={palette.muted} />
        </IconButton>
      </View>
      <View style={{ flexDirection: "row", gap: 4, paddingVertical: 4 }}>
        <IconButton
          label="Pen"
          active={!erase}
          onPress={() => setErase(false)}
          style={{ height: 34, width: 34 }}
        >
          <PenLine size={18} color={palette.accent} />
        </IconButton>
        <IconButton
          label="Eraser"
          active={erase}
          onPress={() => setErase(true)}
          style={{ height: 34, width: 34 }}
        >
          <Eraser size={18} color={palette.muted} />
        </IconButton>
        <View style={{ flex: 1 }} />
        <IconButton
          label="Undo stroke"
          onPress={() => {
            notes.current.set(question, strokes().slice(0, -1));
            redraw();
          }}
          style={{ height: 34, width: 34 }}
        >
          <Undo2 size={18} color={palette.muted} />
        </IconButton>
        <IconButton
          label="Clear working paper"
          onPress={() => {
            notes.current.set(question, []);
            redraw();
          }}
          style={{ height: 34, width: 34 }}
        >
          <Trash2 size={18} color={palette.muted} />
        </IconButton>
      </View>
      <View
        {...responder.panHandlers}
        onLayout={(e) => setLayout(e.nativeEvent.layout)}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: palette.line,
          borderRadius: 5,
          overflow: "hidden",
          backgroundColor: palette.panel,
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 800 700"
          preserveAspectRatio="none"
        >
          <Defs>
            <Pattern
              id="dots"
              width={64}
              height={64}
              patternUnits="userSpaceOnUse"
            >
              <Circle cx={32} cy={32} r={1.5} fill={palette.paperDot} />
            </Pattern>
          </Defs>
          <Rect width={800} height={700} fill="url(#dots)" />
          {strokes().map((stroke, i) => (
            <Path
              key={i}
              d={
                stroke.points
                  .map((p, j) => (j ? "L" : "M") + p.x + " " + p.y)
                  .join(" ") + " l .1 0"
              }
              stroke={stroke.erase ? palette.panel : palette.ink}
              strokeWidth={stroke.size}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}
