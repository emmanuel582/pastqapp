import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import AccountOptions from "../components/AccountOptions";
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
import { Header, Content, Text, Button, Row } from "../components/ui";
import StudySwitch from "../components/StudySwitch";
import type { Navigation } from "../navigation/types";
import { fonts } from "../theme/tokens";
export default function PreferencesScreen({
  navigation,
}: {
  navigation: Navigation;
  onStudy: () => void;
}) {
  const { palette, profile, preferences, setPreferences } = useApp();
  const [showEmail, setShowEmail] = useState(false),
    [accountMenu, setAccountMenu] = useState(false);

  const initials = (profile?.full_name || "Student")
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
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account email"
            accessibilityState={{ expanded: showEmail }}
            onPress={() => setShowEmail((v) => !v)}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {profile?.avatar_local_uri || profile?.avatar_url ? (
              <Image
                source={profile.avatar_local_uri || profile.avatar_url}
                contentFit="cover"
                style={{ width: 34, height: 34, borderRadius: 17 }}
              />
            ) : (
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: palette.accentWash,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: palette.accent,
                    fontSize: 12,
                    fontFamily: fonts.semibold,
                  }}
                >
                  {initials}
                </Text>
              </View>
            )}
          </Pressable>
        }
      />
      <Content
        style={{
          paddingTop: 24,
          paddingBottom: 36,
          paddingHorizontal: 22,
          maxWidth: 744,
        }}
      >
        <Row
          title="Your progress"
          detail="Find topics to practise and see how you improve"
          icon={<ChartNoAxesCombined size={22} color={palette.accent} />}
          onPress={() => navigation.navigate("Progress")}
          style={{ minHeight: 88 }}
        />
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
        <Button
          kind="text"
          onPress={() => setAccountMenu(true)}
          style={{ alignSelf: "center", marginTop: 12 }}
        >
          Account options
        </Button>
      </Content>
      <AccountOptions
        open={accountMenu}
        onClose={() => setAccountMenu(false)}
        navigation={navigation}
      />
      {showEmail ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close account email"
            onPress={() => setShowEmail(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: "absolute",
              right: 16,
              top: 62,
              maxWidth: "90%",
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.panel,
              boxShadow: "0 4px 14px #00000030",
            }}
          >
            <Text selectable style={{ fontSize: 12 }}>
              {profile?.email || "Signed in"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
