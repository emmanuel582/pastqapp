import React from "react";
import { View, Pressable } from "react-native";
import { Image } from "expo-image";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import Bookmark from "lucide-react-native/icons/bookmark";
import Database from "lucide-react-native/icons/database";
import MessageSquareWarning from "lucide-react-native/icons/message-square-warning";
import Bell from "lucide-react-native/icons/bell";
import Moon from "lucide-react-native/icons/moon";
import Sun from "lucide-react-native/icons/sun";
import Monitor from "lucide-react-native/icons/monitor";
import BookOpen from "lucide-react-native/icons/book-open";
import { useApp } from "../state/AppContext";
import {
  Header,
  Content,
  Text,
  Title,
  Muted,
  Button,
  Row,
  ErrorText,
} from "../components/ui";
import StudySwitch from "../components/StudySwitch";
import Scholar from "../components/Scholar";
import type { Navigation } from "../navigation/types";
import { mergeHistory } from "../domain/history";
import { fonts } from "../theme/tokens";
export default function PreferencesScreen({
  navigation,
  onStudy,
}: {
  navigation: Navigation;
  onStudy: () => void;
}) {
  const {
    palette,
    profile,
    attempts,
    preferences,
    setPreferences,
    remoteSessions,
    syncNow,
    syncError,
  } = useApp();
  const completed = mergeHistory(attempts, remoteSessions),
    scores = completed
      .map((a) => a.percent)
      .filter((v): v is number => v !== null),
    recent = completed
      .filter((a) => a.percent !== null)
      .slice(0, 10)
      .reverse(),
    initials = (profile?.full_name || "Student")
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  const settings = [
    { title: "Past sessions", Icon: History, screen: "History" as const },
    { title: "Saved questions", Icon: Bookmark, screen: "Saved" as const },
    { title: "Storage & backup", Icon: Database, screen: "Storage" as const },
    {
      title: "Question reports",
      Icon: MessageSquareWarning,
      screen: "Reports" as const,
    },
    {
      title: "Notifications",
      detail: "Your messages from PastQ",
      Icon: Bell,
      screen: "Notifications" as const,
    },
    {
      title: "Theme",
      detail: preferences.theme[0].toUpperCase() + preferences.theme.slice(1),
      Icon:
        preferences.theme === "dark"
          ? Moon
          : preferences.theme === "light"
            ? Sun
            : Monitor,
      screen: "Theme" as const,
    },
    {
      title: "Study reminders",
      detail: preferences.reminders.enabled
        ? (preferences.reminders.mode === "smart" ? "Smart timing" : "Daily") +
          " · " +
          preferences.reminders.time
        : "Off",
      Icon: Bell,
      screen: "Reminders" as const,
    },
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Preferences"
        style={{ minHeight: 60, paddingVertical: 10 }}
      />
      <Content
        style={{
          paddingTop: 24,
          paddingBottom: 36,
          paddingHorizontal: 22,
          maxWidth: 744,
        }}
      >
        <Pressable
          accessibilityLabel="Your profile"
          onPress={() => navigation.navigate("Profile")}
          style={{
            flexDirection: "row",
            gap: 14,
            alignItems: "center",
            paddingBottom: 28,
          }}
        >
          {profile?.avatar_local_uri || profile?.avatar_url ? (
            <Image
              source={profile?.avatar_local_uri || profile?.avatar_url}
              style={{ width: 46, height: 46, borderRadius: 23 }}
            />
          ) : (
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.accentWash,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: palette.accent,
                  fontFamily: fonts.semibold,
                  fontSize: 15,
                }}
              >
                {initials}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 16, fontFamily: fonts.semibold }}>
              {profile?.full_name || "Student"}
            </Text>
            <Muted>{profile?.email || ""}</Muted>
          </View>
        </Pressable>
        {completed.length ? (
          <View
            style={{
              padding: 18,
              borderWidth: 1,
              borderColor: palette.line,
              borderRadius: 16,
              backgroundColor: palette.panel,
            }}
          >
            <Text style={{ fontSize: 17, fontFamily: fonts.semibold }}>
              Your progress
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 18,
                marginBottom: 20,
              }}
            >
              {[
                { title: "Sessions", value: completed.length },
                {
                  title: "Average",
                  value: scores.length
                    ? Math.round(
                        scores.reduce((a, b) => a + b, 0) / scores.length,
                      ) + "%"
                    : "—",
                },
                {
                  title: "Best",
                  value: scores.length ? Math.max(...scores) + "%" : "—",
                },
              ].map((stat, i) => (
                <View key={stat.title} style={{ flex: 1, gap: 4 }}>
                  <Muted>{stat.title}</Muted>
                  <Title
                    size={26}
                    style={{ color: i === 2 ? palette.accent : palette.ink }}
                  >
                    {stat.value}
                  </Title>
                </View>
              ))}
            </View>
            {recent.length ? (
              <>
                <Svg viewBox="0 0 560 180" width="100%" height={120}>
                  {[0, 50, 100].map((n) => (
                    <React.Fragment key={n}>
                      <Line
                        x1={32}
                        x2={540}
                        y1={150 - n * 1.25}
                        y2={150 - n * 1.25}
                        stroke={palette.line}
                        strokeDasharray="3 4"
                      />
                      <SvgText
                        x={24}
                        y={154 - n * 1.25}
                        textAnchor="end"
                        fill={palette.muted}
                        fontSize={20}
                      >
                        {n}
                      </SvgText>
                    </React.Fragment>
                  ))}
                  <Polyline
                    points={recent
                      .map(
                        (a, i) =>
                          (recent.length === 1
                            ? 286
                            : 42 + (i * 488) / (recent.length - 1)) +
                          "," +
                          (150 - a.percent! * 1.25),
                      )
                      .join(" ")}
                    fill="none"
                    stroke={palette.accent}
                    strokeWidth={2.2}
                  />
                  {recent.map((a, i) => (
                    <Circle
                      key={a.id}
                      cx={
                        recent.length === 1
                          ? 286
                          : 42 + (i * 488) / (recent.length - 1)
                      }
                      cy={150 - a.percent! * 1.25}
                      r={i === recent.length - 1 ? 4 : 3}
                      fill={
                        i === recent.length - 1 ? palette.accent : palette.panel
                      }
                      stroke={palette.accent}
                      strokeWidth={2}
                    />
                  ))}
                </Svg>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingLeft: 28,
                  }}
                >
                  <Muted style={{ fontSize: 11 }}>
                    {new Date(recent[0].completedAt!).toLocaleDateString(
                      undefined,
                      { day: "numeric", month: "short" },
                    )}
                  </Muted>
                  <Muted style={{ fontSize: 11 }}>
                    {new Date(
                      recent[recent.length - 1].completedAt!,
                    ).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </Muted>
                </View>
              </>
            ) : (
              <Muted>Complete an objective session to see scores.</Muted>
            )}
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingBottom: 20 }}>
            <Scholar
              state="study"
              width={168}
              sceneWidth={180}
              sceneHeight={190}
            />
            <Title size={28} style={{ textAlign: "center", marginTop: 12 }}>
              Start with one paper.
            </Title>
            <Button arrow onPress={onStudy} style={{ marginTop: 24 }}>
              Find a paper
            </Button>
          </View>
        )}
        {syncError ? (
          <>
            <ErrorText>{syncError}</ErrorText>
            <Button kind="text" onPress={() => void syncNow()}>
              Retry sync
            </Button>
          </>
        ) : null}
        <View style={{ marginTop: 18 }}>
          {settings.map(({ title, detail, Icon, screen }, index) => (
            <View key={title} style={{ marginTop: index === 2 ? 24 : 0 }}>
              <Row
                title={title}
                detail={detail}
                icon={<Icon size={20} color={palette.accent} />}
                onPress={() => navigation.navigate(screen)}
                style={{ minHeight: index < 2 ? 64 : 72 }}
              />
            </View>
          ))}
          <Row
            title="Preparation environment"
            detail="Open your downloaded exams first."
            icon={<BookOpen size={20} color={palette.accent} />}
            right={
              <StudySwitch
                checked={preferences.preparation}
                label="Preparation environment"
                onChange={(checked) =>
                  void setPreferences({ ...preferences, preparation: checked })
                }
              />
            }
            style={{ minHeight: 88, paddingVertical: 20 }}
          />
        </View>
      </Content>
    </View>
  );
}
