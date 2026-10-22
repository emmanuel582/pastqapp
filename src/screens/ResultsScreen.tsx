import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import BookOpen from "lucide-react-native/icons/book-open";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import * as Crypto from "expo-crypto";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Content,
  Title,
  Text,
  Muted,
  Button,
  Loading,
  ErrorText,
} from "../components/ui";
import TopicTable from "../components/TopicTable";
import Scholar from "../components/Scholar";
import { readAttempt, saveAttempt } from "../storage/practice";
import { attemptSummary, createAttempt } from "../domain/attempt";
import { answerIndex, sessionSummary } from "../domain/examSession";
import { formatTime } from "../components/ExamClock";
import { fonts } from "../theme/tokens";
import type { Attempt } from "../domain/types";
import type { Props } from "../navigation/types";
export default function ResultsScreen({ route, navigation }: Props<"Results">) {
  const { owner, palette, refreshPractice } = useApp();
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void readAttempt(owner, route.params.attemptId)
      .then((a) => {
        if (active) setAttempt(a);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [owner, route.params.attemptId]);
  async function retry(missed = false) {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const questions = missed
        ? attempt.questions.filter(
            (q, i) =>
              answerIndex(q) !== null && attempt.answers[i] !== answerIndex(q),
          )
        : attempt.questions;
      const next = createAttempt(
        {
          id: attempt.bundleId,
          title: attempt.title,
          questions,
          assets: attempt.assets,
        },
        questions,
        attempt.duration,
        attempt.mode,
        owner,
        Crypto.randomUUID(),
      );
      await saveAttempt(next, true);
      await refreshPractice();
      navigation.replace("Exam", { attemptId: next.id });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start another session.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!attempt)
    return (
      <Screen>
        <Header />
        {error ? <ErrorText>{error}</ErrorText> : <Loading />}
      </Screen>
    );
  const summary = attemptSummary(attempt),
    timeTaken = Math.max(
      0,
      Math.round(
        Math.min(
          attempt.duration,
          ((attempt.completedAt || Date.now()) - attempt.startedAt) / 1000,
        ),
      ),
    ),
    subjects = [...new Set(attempt.questions.map((q) => q.subject))],
    missed = attempt.questions.some(
      (q, i) =>
        answerIndex(q) !== null && attempt.answers[i] !== answerIndex(q),
    );
  return (
    <Screen>
      <Header />
      <Content
        style={{
          paddingTop: 28,
          paddingBottom: 40,
          paddingHorizontal: 22,
          maxWidth: 970,
        }}
      >
        <View
          style={{ height: 104, alignItems: "flex-start", marginBottom: 12 }}
        >
          <Scholar
            state="celebrate"
            width={88}
            sceneWidth={112}
            sceneHeight={104}
          />
        </View>
        <Title size={34} style={{ marginTop: 12, marginBottom: 12 }}>
          Session complete
        </Title>
        <View
          style={{
            marginTop: 25,
            padding: 22,
            borderWidth: 1,
            borderColor: palette.line,
            borderRadius: 6,
            backgroundColor:
              palette.scheme === "light" ? palette.panel : palette.wash,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 67,
                  lineHeight: 72,
                  fontFamily: fonts.display,
                  letterSpacing: -4.6,
                }}
              >
                {summary.percent === null ? "—" : summary.percent}
                <Text style={{ fontSize: 24, color: palette.accent }}>
                  {summary.percent === null ? "" : "%"}
                </Text>
              </Text>
              <Muted style={{ fontSize: 9, marginTop: 9 }}>
                {summary.graded
                  ? summary.correct +
                    " of " +
                    summary.graded +
                    " graded questions correct"
                  : summary.answered + " questions practised · ungraded"}
              </Muted>
            </View>
            <Svg width={90} height={63} viewBox="0 0 260 180" fill="none">
              <Path d="M20 156H244" stroke={palette.artInk} opacity={0.25} />
              <Path
                d="M30 155V132H77V105H124V78H171V51H218V25"
                stroke={palette.artInk}
                strokeWidth={2}
              />
              <Path
                d="M32 131H76V154H32zM79 105H123V154H79zM126 78H170V154H126zM173 51H217V154H173z"
                fill={palette.artInk}
                opacity={0.06}
              />
              <Path
                d="m204 23 15 2-1 15"
                stroke={palette.accent}
                strokeWidth={2}
              />
              <Circle cx={124} cy={78} r={5} fill={palette.accent} />
              <Path
                d="M30 126C83 111 117 90 150 66S195 35 218 25"
                stroke={palette.accent}
                strokeWidth={2}
                strokeDasharray="3 5"
              />
            </Svg>
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 10,
              paddingTop: 18,
              marginTop: 22,
              borderTopWidth: 1,
              borderTopColor: palette.line,
            }}
          >
            {[
              { value: summary.correct, label: "Correct" },
              { value: summary.incorrect, label: "Incorrect" },
              { value: summary.skipped, label: "Skipped" },
              { value: formatTime(timeTaken), label: "Time taken" },
              ...(summary.ungraded
                ? [{ value: summary.ungraded, label: "Not auto-marked" }]
                : []),
            ].map((item) => (
              <View key={item.label} style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: 16 }}>
                  {item.value}
                </Text>
                <Muted style={{ fontSize: 9 }}>{item.label}</Muted>
              </View>
            ))}
          </View>
          <Button
            kind="secondary"
            onPress={() =>
              navigation.navigate("Exam", {
                attemptId: attempt.id,
                review: true,
              })
            }
            style={{ marginTop: 22 }}
          >
            <BookOpen size={18} color={palette.ink} />
            <Text style={{ fontSize: 12 }}>Review answers</Text>
            <ArrowRight size={18} color={palette.ink} />
          </Button>
        </View>
        <Button
          arrow
          busy={busy}
          onPress={() => void retry(missed)}
          style={{
            paddingVertical: 26,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
          }}
        >
          {missed ? "Practice these questions" : "Practice again"}
        </Button>
        <View style={{ paddingVertical: 24 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: fonts.semibold,
              marginBottom: 15,
            }}
          >
            By subject
          </Text>
          {subjects.map((subject) => {
            const indexes = attempt.questions.flatMap((q, i) =>
                q.subject === subject ? [i] : [],
              ),
              stats = attemptSummary({
                ...attempt,
                questions: indexes.map((i) => attempt.questions[i]),
                answers: indexes.map((i) => attempt.answers[i]),
                written: indexes.map((i) => attempt.written[i]),
              });
            return (
              <View
                key={subject}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  minHeight: 47,
                }}
              >
                <Text style={{ width: 133, fontSize: 11 }}>{subject}</Text>
                <View
                  style={{ flex: 1, height: 3, backgroundColor: palette.wash }}
                >
                  <View
                    style={{
                      height: 3,
                      width: ((stats.percent || 0) + "%") as `${number}%`,
                      backgroundColor: palette.accent,
                    }}
                  />
                </View>
                <Muted style={{ fontSize: 10, fontFamily: fonts.mono }}>
                  {stats.graded
                    ? stats.correct + "/" + stats.graded
                    : stats.answered + "/" + indexes.length + " practised"}
                </Muted>
              </View>
            );
          })}
        </View>
        <TopicTable attempt={attempt} />
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: palette.line,
            paddingTop: 22,
            gap: 9,
          }}
        >
          <Button
            arrow
            onPress={() => navigation.navigate("Main", { tab: "library" })}
          >
            Browse materials
          </Button>
          <Button kind="text" onPress={() => void retry()}>
            <RotateCcw size={16} color={palette.accent} />
            <Text style={{ color: palette.accent, fontSize: 13 }}>
              Retake exam
            </Text>
          </Button>
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </Content>
    </Screen>
  );
}
