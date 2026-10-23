import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, PanResponder } from "react-native";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";
import { useApp } from "../state/AppContext";
import { Text, Muted } from "./ui";
import {
  progressPlot,
  nearestProgressPoint,
  type ProgressDatum,
} from "../domain/progressChart";
import { fonts } from "../theme/tokens";
export default function ProgressChart({ items }: { items: ProgressDatum[] }) {
  const { palette } = useApp();
  const [width, setWidth] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const plot = useMemo(() => progressPlot(items, width), [items, width]),
    points = plot.points;
  const index = Math.max(
      0,
      selected ? points.findIndex((v) => v.id === selected) : points.length - 1,
    ),
    active = points[index];
  const context = useRef({ points, index });
  context.current = { points, index };
  useEffect(() => {
    if (selected && !points.some((v) => v.id === selected)) setSelected(null);
  }, [points, selected]);
  const origin = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: (e) => {
          origin.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
          pick(e.nativeEvent.locationX);
        },
        onPanResponderMove: (_e, g) => pick(g.moveX - origin.current),
      }),
    [],
  );
  function pick(x: number) {
    const rows = context.current.points;
    if (rows.length) setSelected(rows[nearestProgressPoint(rows, x)].id);
  }
  const date = (at: number) =>
    new Date(at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  return (
    <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 80 && points.length ? (
        <>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Session scores. Swipe left or right to select a session."
            accessibilityValue={{
              min: 1,
              max: points.length,
              now: index + 1,
              text:
                active.percent +
                " percent, " +
                active.title +
                ", " +
                date(active.completedAt),
            }}
            accessibilityActions={[
              { name: "increment", label: "Next session" },
              { name: "decrement", label: "Previous session" },
            ]}
            onAccessibilityAction={(e) => {
              const next = Math.min(
                points.length - 1,
                Math.max(
                  0,
                  index + (e.nativeEvent.actionName === "increment" ? 1 : -1),
                ),
              );
              setSelected(points[next].id);
            }}
            {...pan.panHandlers}
          >
            <Pressable
              accessible={false}
              onPress={(e) => pick(e.nativeEvent.locationX)}
            >
              <Svg pointerEvents="none" width={width} height={plot.height}>
                {[0, 25, 50, 75, 100].map((n) => {
                  const y = plot.bottom - ((plot.bottom - plot.top) * n) / 100;
                  return (
                    <React.Fragment key={n}>
                      <Line
                        x1={plot.left}
                        x2={plot.right}
                        y1={y}
                        y2={y}
                        stroke={palette.line}
                        strokeDasharray="3 4"
                      />
                      <SvgText
                        x={plot.left - 7}
                        y={y + 4}
                        textAnchor="end"
                        fill={palette.muted}
                        fontSize={11}
                      >
                        {n}%
                      </SvgText>
                    </React.Fragment>
                  );
                })}
                <Polyline
                  points={points.map((p) => p.x + "," + p.y).join(" ")}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={2}
                />
                <Line
                  x1={active.x}
                  x2={active.x}
                  y1={plot.top}
                  y2={plot.bottom}
                  stroke={palette.muted}
                  strokeDasharray="3 4"
                />
                {points.map((p, i) => (
                  <Circle
                    key={p.id}
                    cx={p.x}
                    cy={p.y}
                    r={i === index ? 5 : 3}
                    fill={i === index ? palette.accent : palette.panel}
                    stroke={palette.accent}
                    strokeWidth={2}
                  />
                ))}
                <SvgText
                  x={plot.left}
                  y={plot.height - 5}
                  fill={palette.muted}
                  fontSize={10}
                >
                  {date(points[0].completedAt)}
                </SvgText>
                {points.length > 1 ? (
                  <SvgText
                    x={plot.right}
                    y={plot.height - 5}
                    textAnchor="end"
                    fill={palette.muted}
                    fontSize={10}
                  >
                    {date(points[points.length - 1].completedAt)}
                  </SvgText>
                ) : null}
              </Svg>
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, fontFamily: fonts.semibold }}
              >
                {active.title}
              </Text>
              <Muted style={{ fontSize: 10 }}>
                {new Date(active.completedAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · Tap or slide to inspect
              </Muted>
            </View>
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 22,
                fontFamily: fonts.mono,
                color: palette.accent,
              }}
            >
              {active.percent}%
            </Text>
          </View>
        </>
      ) : (
        <Muted>Complete an objective session to see scores.</Muted>
      )}
    </View>
  );
}
