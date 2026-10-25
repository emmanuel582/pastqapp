import { useMemo } from "react";
import { Pressable, View } from "react-native";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import { useApp } from "../state/AppContext";
import { Text } from "./ui";
import { mergeHistory } from "../domain/history";
import { sessionActivity } from "../domain/sessionActivity";
import { fonts } from "../theme/tokens";
export default function SessionActivityCard({
  onPress,
}: {
  onPress: () => void;
}) {
  const { palette, attempts, remoteSessions, deletedSessions } = useApp();
  const items = useMemo(
    () => mergeHistory(attempts, remoteSessions, deletedSessions),
    [attempts, remoteSessions, deletedSessions],
  );
  // Seven tiny native bars; no chart library, fetch or animation loop.
  const activity = sessionActivity(items);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        "Your progress. " +
        activity.total +
        (activity.total === 1
          ? " session completed, "
          : " sessions completed, ") +
        activity.recent +
        " in the last seven days. Open detailed progress."
      }
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.line,
        backgroundColor: palette.panel,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
          Sessions
        </Text>
        <ArrowUpRight size={18} color={palette.accent} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: 9,
          marginTop: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 36,
            lineHeight: 43,
            letterSpacing: -1,
            color: palette.ink,
          }}
        >
          {activity.total.toLocaleString()}
        </Text>
      </View>
      <View
        style={{ flexDirection: "row", gap: 8, height: 85 }}
        accessible={false}
      >
        {activity.days.map((day) => (
          <View
            key={day.key}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            <View
              style={{
                height: 65,
                width: "100%",
                alignItems: "center",
                justifyContent: "flex-end",
                borderBottomWidth: 1,
                borderColor: palette.line,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  lineHeight: 15,
                  color: day.count ? palette.soft : palette.faint,
                  marginBottom: 3,
                }}
              >
                {day.count}
              </Text>
              <View
                style={{
                  width: "55%",
                  maxWidth: 24,
                  height: day.count
                    ? Math.max(1, Math.round((day.count / activity.max) * 45))
                    : 0,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: palette.accent,
                }}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 10,
                lineHeight: 15,
                color: palette.muted,
                marginTop: 5,
              }}
            >
              {day.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
