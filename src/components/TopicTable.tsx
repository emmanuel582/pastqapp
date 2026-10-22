import React from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { Text, Muted } from "./ui";
import { useApp } from "../state/AppContext";
import { fonts } from "../theme/tokens";
import { topicBreakdown } from "../domain/breakdown";
import type { Attempt } from "../domain/types";
const columns = [
  { key: "total", label: "Questions" },
  { key: "correct", label: "Correct" },
  { key: "missed", label: "Missed" },
  { key: "unanswered", label: "Unanswered" },
  { key: "attempted", label: "Attempted" },
  { key: "ungraded", label: "Ungraded" },
] as const;
export default function TopicTable({ attempt }: { attempt: Attempt }) {
  const { palette } = useApp(),
    rows = topicBreakdown(attempt),
    { width } = useWindowDimensions(),
    compact = width < 480;
  const nameWidth = compact ? 126 : 210,
    metricWidth = compact ? 60 : 74;
  const cell = {
    width: metricWidth,
    textAlign: "right" as const,
    fontFamily: fonts.mono,
    fontSize: 12,
  };
  return (
    <View
      style={{
        paddingVertical: 24,
        borderTopWidth: 1,
        borderTopColor: palette.line,
      }}
    >
      <Text
        style={{ fontSize: 16, fontFamily: fonts.semibold, marginBottom: 10 }}
      >
        By topic
      </Text>
      <Muted style={{ marginBottom: 16 }}>
        Missed counts wrong answers. Swipe for attempted, unanswered and
        ungraded counts.
      </Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View accessibilityRole="summary">
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
            }}
          >
            <Text
              style={{
                width: nameWidth,
                fontFamily: fonts.semibold,
                fontSize: 12,
              }}
            >
              Subject / topic
            </Text>
            {columns.map((column) => (
              <Text
                key={column.key}
                style={{
                  ...cell,
                  fontFamily: fonts.semibold,
                  fontSize: compact ? 9 : 10,
                }}
              >
                {column.label}
              </Text>
            ))}
          </View>
          {rows.map((row) => (
            <View
              key={JSON.stringify([row.subject, row.topic])}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
              }}
            >
              <View style={{ width: nameWidth, paddingRight: 12, gap: 5 }}>
                <Muted style={{ fontSize: 10 }}>{row.subject}</Muted>
                <Text style={{ fontSize: 12 }}>{row.topic}</Text>
              </View>
              {columns.map((column) => (
                <Text
                  key={column.key}
                  style={{
                    ...cell,
                    color:
                      column.key === "correct" ? palette.accent : palette.ink,
                  }}
                >
                  {row[column.key]}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
