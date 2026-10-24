import React, { useEffect, useState, useRef } from "react";
import { View, Pressable } from "react-native";
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
  Dialog,
  ErrorText,
} from "../components/ui";
import TopicTable from "../components/TopicTable";
import QuestionNumbers from "../components/QuestionNumbers";
import { reviewQuestions, type AnswerFilter } from "../domain/review";
import Scholar from "../components/Scholar";
import { readAttempt, saveAttempt } from "../storage/practice";
import { isWrittenQuestion } from "../domain/theory";
import { attemptSummary, createAttempt } from "../domain/attempt";
import { answerIndex, sessionSummary } from "../domain/examSession";
import { formatTime } from "../components/ExamClock";
import { fonts } from "../theme/tokens";
import type { Attempt } from "../domain/types";
import type { Props } from "../navigation/types";
export default function ResultsScreen({ route, navigation }: Props<"Results">) {
  const { owner, palette, refreshPractice } = useApp();
  const actionLock = useRef(false);
  useEffect(
    () =>
      navigation.addListener("focus", () => {
        actionLock.current = false;
      }),
    [navigation],
  );
  function openReview(questionIndex = 0, reviewFilter: AnswerFilter = "all") {
    if (!attempt || actionLock.current) return;
    actionLock.current = true;
    setReviewGroup(null);
    navigation.navigate("Exam", {
      attemptId: attempt.id,
      review: true,
      questionIndex,
      reviewFilter,
    });
  }
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [reviewGroup, setReviewGroup] = useState<AnswerFilter | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void readAttempt(owner, route.params.attemptId)
      .then((a) => {
        if (active) setAttempt(a);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [owner, route.params.attemptId]);
  async function retry(missed = false) {
    if (!attempt || busy || actionLock.current) return;
    actionLock.current = true;
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
      actionLock.current = false;
      setBusy(false);
    }
  }
  if (!attempt)
    return (
      <Screen>
        <Header title="Session complete" />
        {error ? <ErrorText>{error}</ErrorText> : <Loading />}
      </Screen>
    );
  const writtenOnly = attempt.questions.every(isWrittenQuestion);
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
      <Header title="Session complete" />
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
                  fontSize: writtenOnly ? 44 : 67,
                  lineHeight: 72,
                  fontFamily: fonts.display,
                  letterSpacing: writtenOnly ? -2 : -4.6,
                }}
              >
                {writtenOnly
                  ? `${summary.answered}/${attempt.questions.length}`
                  : summary.percent === null
                    ? "—"
                    : summary.percent}
                <Text style={{ fontSize: 24, color: palette.accent }}>
                  {summary.percent === null ? "" : "%"}
                </Text>
              </Text>
              <Muted style={{ fontSize: 9, marginTop: 9 }}>
                {writtenOnly
                  ? "Not auto-marked"
                  : summary.graded
                    ? summary.correct +
                      " of " +
                      summary.graded +
                      " graded questions correct"
                    : summary.answered + " questions practised · ungraded"}
              </Muted>
            </View>
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
            {(
              [
                ...(writtenOnly
                  ? [
                      {
                        value: summary.answered,
                        label: "Answered",
                        filter: "reviewed",
                        color: palette.ink,
                        wash: palette.wash,
                      },
                    ]
                  : [
                      {
                        value: summary.correct,
                        label: "Correct",
                        filter: "correct",
                        color: palette.ink,
                        wash: palette.wash,
                      },
                      {
                        value: summary.incorrect,
                        label: "Wrong",
                        filter: "incorrect",
                        color: palette.ink,
                        wash: palette.wash,
                      },
                    ]),
                {
                  value: summary.skipped,
                  label: "Unanswered",
                  filter: "skipped",
                  color: palette.ink,
                  wash: palette.wash,
                },
                {
                  value: formatTime(timeTaken),
                  label: "Time taken",
                  filter: null,
                  color: palette.ink,
                  wash: palette.wash,
                },
                ...(summary.ungraded && !writtenOnly
                  ? [
                      {
                        value: summary.ungraded,
                        label: "Not auto-marked",
                        filter: "reviewed",
                        color: palette.ink,
                        wash: palette.wash,
                      },
                    ]
                  : []),
              ] as {
                value: number | string;
                label: string;
                filter: AnswerFilter | null;
                color: string;
                wash: string;
              }[]
            ).map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole={item.filter ? "button" : undefined}
                disabled={!item.filter}
                accessibilityLabel={
                  item.filter
                    ? "Review " +
                      item.value +
                      " " +
                      item.label.toLowerCase() +
                      " questions"
                    : "Time taken " + item.value
                }
                onPress={() => setReviewGroup(item.filter)}
                style={({ pressed }) => ({
                  flexBasis: "47%",
                  minWidth: 0,
                  flexGrow: 1,
                  gap: 4,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: item.wash,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 22,
                    lineHeight: 29,
                    color: item.color,
                  }}
                >
                  {item.value}
                </Text>
                <Text style={{ fontSize: 12, color: item.color }}>
                  {item.label === "Correct"
                    ? "✓ "
                    : item.label === "Wrong"
                      ? "× "
                      : ""}
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            kind="secondary"
            onPress={() => openReview()}
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
          {missed ? "Practise missed questions" : "Practice again"}
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
                      width: ((stats.percent ??
                        (stats.answered * 100) / indexes.length) +
                        "%") as `${number}%`,
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
      {reviewGroup ? (
        <Dialog
          title={
            reviewGroup === "correct"
              ? "Correct answers"
              : reviewGroup === "incorrect"
                ? "Wrong answers"
                : reviewGroup === "skipped"
                  ? "Unanswered questions"
                  : reviewGroup === "reviewed"
                    ? "Not auto-marked"
                    : "Your answers"
          }
          onClose={() => setReviewGroup(null)}
        >
          <QuestionNumbers
            attempt={attempt}
            indexes={reviewQuestions(attempt, reviewGroup)}
            review
            onSelect={(questionIndex) => {
              openReview(questionIndex, reviewGroup);
            }}
          />
        </Dialog>
      ) : null}
    </Screen>
  );
}
