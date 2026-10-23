import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useApp } from "../state/AppContext";
import { Text, Muted } from "./ui";
import { progressPlot, type ProgressDatum } from "../domain/progressChart";
import { fonts } from "../theme/tokens";
export default function ProgressChart({ items }: { items: ProgressDatum[] }) {
  const { palette } = useApp();
  const [width, setWidth] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const plot = useMemo(() => progressPlot(items, width), [items, width]),
    points = plot.points;
  const active =
      points.find((p) => p.id === selected) || points[points.length - 1],
    index = active ? points.indexOf(active) : -1;
  const date = (at: number) =>
    new Date(at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  return (
    <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
        Your last {points.length || 5} scored test
        {points.length === 1 ? "" : "s"}
      </Text>
      <Muted style={{ fontSize: 11, marginTop: 3, marginBottom: 10 }}>
        Each bar is one test. Taller bars mean higher scores.
      </Muted>
      {width > 80 && active ? (
        <>
          <View style={{ height: plot.height }}>
            <Svg pointerEvents="none" width={width} height={plot.height}>
              {[0, 50, 100].map((n) => {
                const y = plot.bottom - ((plot.bottom - plot.top) * n) / 100;
                return (
                  <React.Fragment key={n}>
                    <Line
                      x1={plot.left}
                      x2={plot.right}
                      y1={y}
                      y2={y}
                      stroke={palette.line}
                    />
                    <SvgText
                      x={plot.left - 6}
                      y={y + 4}
                      textAnchor="end"
                      fill={palette.muted}
                      fontSize={10}
                    >
                      {n}%
                    </SvgText>
                  </React.Fragment>
                );
              })}
              {points.map((p, i) => (
                <React.Fragment key={p.id}>
                  <Rect
                    x={p.x - plot.barWidth / 2}
                    y={Math.min(plot.bottom - 2, p.y)}
                    width={plot.barWidth}
                    height={Math.max(2, plot.bottom - p.y)}
                    rx={3}
                    fill={palette.accent}
                    opacity={i === index ? 1 : 0.5}
                  />
                  <SvgText
                    x={p.x}
                    y={Math.max(15, p.y - 8)}
                    textAnchor="middle"
                    fill={i === index ? palette.ink : palette.muted}
                    fontSize={11}
                    fontWeight={i === index ? "bold" : "normal"}
                  >
                    {p.percent}%
                  </SvgText>
                  <SvgText
                    x={p.x}
                    y={plot.height - 7}
                    textAnchor="middle"
                    fill={i === index ? palette.ink : palette.muted}
                    fontSize={11}
                  >
                    {i + 1}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>
            {points.map((p, i) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={
                  "Test " +
                  (i + 1) +
                  ", " +
                  p.percent +
                  " percent, " +
                  p.title +
                  ", " +
                  date(p.completedAt)
                }
                accessibilityState={{ selected: p.id === active.id }}
                onPress={() => setSelected(p.id)}
                style={{
                  position: "absolute",
                  left: plot.left + plot.slot * i,
                  top: 0,
                  width: plot.slot,
                  height: plot.height,
                }}
              />
            ))}
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderColor: palette.line,
              paddingTop: 12,
              marginTop: 4,
              gap: 4,
            }}
          >
            <Text
              style={{ fontSize: 14, fontFamily: fonts.semibold }}
              accessibilityLiveRegion="polite"
            >
              Test {index + 1}: {active.percent}%
              {Number.isFinite(active.correct) &&
              Number.isFinite(active.total) &&
              active.total! > 0
                ? " · " + active.correct + " of " + active.total + " correct"
                : ""}
            </Text>
            <Text numberOfLines={2} style={{ fontSize: 12 }}>
              {active.title}
            </Text>
            <Muted style={{ fontSize: 11 }}>
              {date(active.completedAt)} · Tap a bar to see that test
            </Muted>
          </View>
        </>
      ) : (
        <Muted>Finish a marked test to see your scores here.</Muted>
      )}
    </View>
  );
}
