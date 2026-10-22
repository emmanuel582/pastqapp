import * as records from "../storage/records";
import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import BookOpen from "lucide-react-native/icons/book-open";
import Upload from "lucide-react-native/icons/upload";
import Download from "lucide-react-native/icons/download";
import { useApp } from "../state/AppContext";
import {
  Header,
  Content,
  Title,
  Text,
  Muted,
  Button,
  Row,
} from "../components/ui";
import Scholar from "../components/Scholar";
import ExamArtwork from "../components/ExamArtwork";
import { fonts } from "../theme/tokens";
import type { Navigation } from "../navigation/types";
export default function HomeScreen({
  navigation,
  onLibrary,
}: {
  navigation: Navigation;
  onLibrary: () => void;
}) {
  const { palette, profile, saved, attempts, owner } = useApp();
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void records
      .read<string>(owner, "processing", "current")
      .then((id) => {
        if (active) setPendingUpload(id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [owner]);
  const completed = attempts.filter((a) => a.status === "completed");
  const scores = completed
    .map((a) => a.summary.percent)
    .filter((n): n is number => n !== null);
  const plan = useMemo(() => {
    const latest = (id: string) => completed.find((a) => a.bundleId === id);
    const weak = saved
      .filter((m) => {
        const score = latest(m.id)?.summary.percent;
        return score != null && score < 75;
      })
      .sort(
        (a, b) =>
          latest(a.id)!.summary.percent! - latest(b.id)!.summary.percent!,
      );
    const untried = saved.find((m) => !latest(m.id));
    const material = weak[0] || untried || saved[0];
    return {
      material,
      reason: weak.length
        ? "Worth another look"
        : untried
          ? "Next from your saved papers"
          : "Keep it fresh",
      percent: material ? latest(material.id)?.summary.percent : null,
    };
  }, [saved, attempts]);
  const first = profile?.full_name.trim().split(/\s+/)[0] || "there";
  return (
    <View style={{ flex: 1 }}>
      <Header
        right={<Muted>{profile?.study_focus?.name || "Your study room"}</Muted>}
      />
      <Content style={{ paddingTop: 28 }}>
        <Title size={31} style={{ marginBottom: 25 }}>
          Hi, {first}.
        </Title>
        {attempts.find((a) => a.status === "active")
          ? (() => {
              const a = attempts.find((a) => a.status === "active")!;
              return (
                <View
                  style={{
                    padding: 18,
                    borderWidth: 1,
                    borderColor: palette.line,
                    borderRadius: 16,
                    backgroundColor: palette.panel,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={{ fontFamily: fonts.semibold }}>
                      {a.title}
                    </Text>
                    <Muted>
                      {a.summary.answered} of {a.questionCount} answered
                    </Muted>
                  </View>
                  <Button
                    arrow
                    onPress={() =>
                      navigation.navigate("Exam", { attemptId: a.id })
                    }
                  >
                    Resume
                  </Button>
                </View>
              );
            })()
          : null}
        {pendingUpload ? (
          <Row
            title="Your questions are being prepared"
            detail="Continue reviewing your uploaded material."
            onPress={() =>
              navigation.navigate("Processing", { sessionId: pendingUpload })
            }
            right={<ArrowRight size={19} color={palette.accent} />}
            style={{ marginBottom: 24 }}
          />
        ) : null}
        {plan.material ? (
          <>
            <View
              style={{
                minHeight: 240,
                paddingVertical: 24,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: palette.line,
                borderRadius: 18,
                backgroundColor: palette.panel,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Muted>{plan.reason}</Muted>
                <Title size={25} style={{ marginTop: 12, marginBottom: 16 }}>
                  {plan.material.title}
                </Title>
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 5,
                      alignItems: "center",
                    }}
                  >
                    <Download size={14} color={palette.muted} />
                    <Muted style={{ fontSize: 11 }}>Ready offline</Muted>
                  </View>
                  <Muted style={{ fontSize: 11 }}>
                    {plan.material.question_count ??
                      plan.material.questions.length}{" "}
                    questions
                    {plan.percent != null
                      ? " · Last score " + plan.percent + "%"
                      : ""}
                  </Muted>
                </View>
                <Button
                  arrow
                  onPress={() =>
                    navigation.navigate("Setup", {
                      bundleId: plan.material!.id,
                    })
                  }
                  style={{ marginTop: 24, alignSelf: "flex-start" }}
                >
                  Practice
                </Button>
              </View>
              <Scholar
                state={
                  plan.percent != null && plan.percent < 75
                    ? "encourage"
                    : "study"
                }
                width={110}
                sceneWidth={94}
                sceneHeight={150}
              />
            </View>
            {completed.length ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 24,
                  flexWrap: "wrap",
                  paddingTop: 20,
                }}
              >
                <Muted>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
                    {completed.length}
                  </Text>{" "}
                  session{completed.length === 1 ? "" : "s"} completed
                </Muted>
                {scores.length ? (
                  <Muted>
                    <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                      {Math.round(
                        scores.reduce((a, b) => a + b, 0) / scores.length,
                      )}
                      %
                    </Text>{" "}
                    average
                  </Muted>
                ) : null}
              </View>
            ) : null}
            <View style={{ marginTop: 30 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 16, fontFamily: fonts.semibold }}>
                  On your device
                </Text>
                <Button kind="text" arrow onPress={onLibrary}>
                  Library
                </Button>
              </View>
              {saved.slice(0, 3).map((material) => (
                <Pressable
                  key={material.id}
                  onPress={() =>
                    navigation.navigate("Setup", { bundleId: material.id })
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.line,
                  }}
                >
                  <ExamArtwork identity={material} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={{ fontFamily: fonts.semibold }}>
                      {material.title}
                    </Text>
                    <Muted>
                      {material.question_count ?? material.questions.length}{" "}
                      questions
                    </Muted>
                  </View>
                  <ArrowRight size={17} color={palette.ink} />
                </Pressable>
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Row
                title="Find another paper"
                icon={<BookOpen size={22} color={palette.ink} />}
                onPress={onLibrary}
                right={<ArrowRight size={18} color={palette.ink} />}
              />
              <Row
                title="Add material"
                icon={<Upload size={22} color={palette.ink} />}
                onPress={() => navigation.navigate("Upload")}
                right={<ArrowRight size={18} color={palette.ink} />}
              />
            </View>
          </>
        ) : (
          <View
            style={{ alignItems: "center", paddingTop: 8, paddingBottom: 30 }}
          >
            <Scholar
              state="encourage"
              width={168}
              sceneWidth={180}
              sceneHeight={190}
            />
            <Title size={32} style={{ marginTop: 8 }}>
              Your first paper.
            </Title>
            <Button arrow onPress={onLibrary} style={{ marginTop: 24 }}>
              Find a paper
            </Button>
            <Button
              kind="text"
              onPress={() => navigation.navigate("Upload")}
              style={{ marginTop: 18 }}
            >
              <Upload size={17} color={palette.accent} />
              <Text
                style={{
                  color: palette.accent,
                  fontSize: 13,
                  fontFamily: fonts.semibold,
                }}
              >
                Add your own material
              </Text>
            </Button>
          </View>
        )}
      </Content>
    </View>
  );
}
