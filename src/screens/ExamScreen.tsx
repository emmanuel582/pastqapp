import { resolveQuestion } from "../storage/bank";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  BackHandler,
  useWindowDimensions,
} from "react-native";
import { usePreventRemove, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Bookmark from "lucide-react-native/icons/bookmark";
import BookOpen from "lucide-react-native/icons/book-open";
import CalculatorIcon from "lucide-react-native/icons/calculator";
import Check from "lucide-react-native/icons/check";
import Grid2X2 from "lucide-react-native/icons/grid-2x2";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import PenLine from "lucide-react-native/icons/pen-line";
import X from "lucide-react-native/icons/x";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Text,
  Title,
  Muted,
  Button,
  IconButton,
  Dialog,
  ErrorText,
  Loading,
  Empty,
} from "../components/ui";
import QuestionSwipeSurface from "../components/QuestionSwipeSurface";
import {
  isWrittenQuestion,
  theoryLabel,
  theoryLocation,
  theorySolution,
} from "../domain/theory";
import QuestionNumbers from "../components/QuestionNumbers";
import {
  reviewQuestions,
  outcomeLabel,
  type ReviewFilter,
} from "../domain/review";
import { adjacentQuestion } from "../domain/swipe";
import ExamClock from "../components/ExamClock";
import RichText from "../components/RichText";
import QuestionMedia from "../components/QuestionMedia";
import QuestionReport from "../components/QuestionReport";
import { DrawingBoard } from "../components/StudyTools";
import FloatingCalculator from "../components/FloatingCalculator";
import type { ToolFrame } from "../domain/floatingTool";
import { readAttempt, saveAttempt, toggleBookmark } from "../storage/practice";
import {
  attemptSummary,
  completeAttempt,
  bookmarkIdentity,
  questionIdentity,
  questionAnswered,
  questionOutcome,
} from "../domain/attempt";
import { answerIndex } from "../domain/examSession";
import {
  subjectQuestionGroups,
  subjectQuestionPosition,
} from "../domain/subjectNavigation";
import { syncHistory } from "../services/history";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Attempt } from "../domain/types";
import type { Props } from "../navigation/types";
export default function ExamScreen({ route, navigation }: Props<"Exam">) {
  const { owner, palette, bookmarks, refreshPractice, syncNow } = useApp(),
    insets = useSafeAreaInsets(),
    window = useWindowDimensions(),
    sideTools = window.width > window.height && window.height < 600;
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [error, setError] = useState(""),
    [navigator, setNavigator] = useState(false),
    [navigatorFilter, setNavigatorFilter] = useState<
      "all" | "answered" | "skipped"
    >("all"),
    [finish, setFinish] = useState(false),
    [calculator, setCalculator] = useState(false),
    [board, setBoard] = useState(false),
    [scale, setScale] = useState(1),
    [reviewFilter, setReviewFilter] = useState<ReviewFilter>(
      route.params.reviewFilter || "all",
    ),
    [leaving, setLeaving] = useState<(() => void) | null>(null),
    [busy, setBusy] = useState(false),
    [bookmarkBusy, setBookmarkBusy] = useState(false),
    [writingFocused, setWritingFocused] = useState(false);
  const calculatorFrame = useRef<ToolFrame | null>(null);
  const latest = useRef<Attempt | null>(null),
    submitLock = useRef(false),
    questionNavigation = useRef(false),
    scroll = useRef<React.ElementRef<typeof ScrollView>>(null),
    subjectPositions = useRef(new Map<string, number>());
  const review = !!route.params.review;
  const [questionError, setQuestionError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const [resolved, setResolved] = useState<{
    key: string;
    question: import("../domain/types").Question;
    assets?: Attempt["assets"];
  } | null>(null);
  useEffect(() => {
    let active = true;
    const q = attempt?.questions[attempt.current];
    if (!q || typeof q.nativeRef !== "string") {
      setResolved(null);
      return;
    }
    setQuestionError("");
    const key = attempt!.id + ":" + attempt!.current;
    void resolveQuestion(owner, q)
      .then((value) => {
        if (active) {
          setResolved({ key, ...value });
          setQuestionError("");
        }
      })
      .catch((e) => {
        if (active) setQuestionError(e.message);
      });
    return () => {
      active = false;
    };
  }, [owner, attempt?.id, attempt?.current, loadRevision]);
  useEffect(() => {
    let active = true;
    void readAttempt(owner, route.params.attemptId)
      .then((saved) => {
        const index = route.params.questionIndex;
        const a =
          saved &&
          review &&
          Number.isInteger(index) &&
          index! >= 0 &&
          index! < saved.questions.length
            ? { ...saved, current: index! }
            : saved;
        if (active) {
          latest.current = a;
          setAttempt(a);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [owner, route.params.attemptId, route.params.questionIndex]);
  useEffect(() => {
    setReviewFilter(route.params.reviewFilter || "all");
  }, [route.params.reviewFilter]);
  usePreventRemove(
    !review && (!attempt ? !error : attempt.status === "active"),
    ({ data }) => setLeaving(() => () => navigation.dispatch(data.action)),
  );
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (leaving) {
          setLeaving(null);
          return true;
        }
        if (finish) {
          setFinish(false);
          return true;
        }
        if (navigator) {
          setNavigator(false);
          return true;
        }
        if (calculator) {
          setCalculator(false);
          return true;
        }
        if (board) {
          void workingFlush
            .current?.()
            .then(() => setBoard(false))
            .catch(() =>
              setError("Save your working before closing the board."),
            );
          return true;
        }
        if (
          !review &&
          (!latest.current || latest.current.status === "active")
        ) {
          navigation.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [
      busy,
      leaving,
      finish,
      navigator,
      calculator,
      board,
      review,
      navigation,
    ]),
  );
  function update(value: Partial<Attempt>) {
    if (!latest.current || (!review && submitLock.current)) return;
    const next = { ...latest.current, ...value };
    latest.current = next;
    setAttempt(next);
    if (!review)
      void saveAttempt(next).catch(() =>
        setError(
          "Your latest answer could not be saved. Free some device storage, then tap Retry save.",
        ),
      );
  }
  const workingFlush = useRef<(() => Promise<void>) | null>(null);
  async function submit() {
    if (submitLock.current || !latest.current || review) return;
    submitLock.current = true;
    setBusy(true);
    try {
      await workingFlush.current?.();
      const done = completeAttempt(latest.current);
      await saveAttempt(done);
      const evidence = done.questions.map((q, i) => ({
        kind: "learning-evidence",
        id: done.bundleId + ":" + questionIdentity(q),
        value: {
          key: questionIdentity(q),
          bundleId: done.bundleId,
          subject: q.subject,
          topic: q.topic || q.section || null,
          year: q.year || "",
          paper: q.paper || "",
          at: done.completedAt,
          outcome: questionOutcome(done, i),
        },
      }));
      await records.restore(owner, evidence);
      latest.current = done;
      setAttempt(done);
      setFinish(false);
      await refreshPractice();
      void syncNow();
      setTimeout(
        () => navigation.replace("Results", { attemptId: done.id }),
        0,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your exam could not be saved. Retry before leaving.",
      );
      submitLock.current = false;
    } finally {
      setBusy(false);
    }
  }
  const bookmarkIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.id)),
    [bookmarks],
  );
  const totals = useMemo(
    () => (attempt ? attemptSummary(attempt) : null),
    [attempt?.questions, attempt?.answers, attempt?.written],
  );
  const reviewIndexes = useMemo(() => {
    if (!attempt) return [];
    const rows = reviewQuestions(
      attempt,
      !review || reviewFilter === "saved" ? "all" : reviewFilter,
    );
    return review && reviewFilter === "saved"
      ? rows.filter((i) =>
          bookmarkIds.has(
            bookmarkIdentity(attempt.bundleId, attempt.questions[i]),
          ),
        )
      : rows;
  }, [
    attempt?.questions,
    attempt?.answers,
    attempt?.written,
    review,
    reviewFilter,
    bookmarkIds,
  ]);
  const reviewIndexSet = useMemo(() => new Set(reviewIndexes), [reviewIndexes]);
  const grouped = useMemo(
    () =>
      new Map(
        [...subjectQuestionGroups(attempt?.questions || [])]
          .map(
            ([subject, indexes]) =>
              [subject, indexes.filter((i) => reviewIndexSet.has(i))] as const,
          )
          .filter(([, indexes]) => indexes.length),
      ),
    [attempt?.questions, reviewIndexSet],
  );
  const orderedIndexes = useMemo(() => [...grouped.values()].flat(), [grouped]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [attempt?.current]);
  useEffect(() => {
    if (
      review &&
      attempt &&
      reviewIndexes.length &&
      !reviewIndexes.includes(attempt.current)
    )
      update({ current: reviewIndexes[0] });
  }, [reviewIndexes]);
  function leaveDialog() {
    return leaving ? (
      <Dialog
        title="Leave this exam?"
        onClose={() => {
          if (!busy) setLeaving(null);
        }}
      >
        <Muted>
          Save and resume in Past sessions. The clock keeps running.
        </Muted>
        <Button
          kind="secondary"
          disabled={busy}
          onPress={() => setLeaving(null)}
          style={{ marginTop: 20 }}
        >
          Keep working
        </Button>
        <Button
          disabled={busy}
          onPress={() => {
            void (async () => {
              setBusy(true);
              try {
                await workingFlush.current?.();
                if (latest.current) await saveAttempt(latest.current);
                const action = leaving!;
                setLeaving(null);
                action();
              } catch {
                setError("Your work could not be saved. Retry before leaving.");
              } finally {
                setBusy(false);
              }
            })();
          }}
          style={{ marginTop: 12 }}
        >
          {busy ? "Saving…" : "Save and leave"}
        </Button>
      </Dialog>
    ) : null;
  }
  if (!attempt)
    return (
      <Screen>
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <Loading label="Opening your saved exam" />
        )}
        {leaveDialog()}
      </Screen>
    );
  const loaded =
    resolved?.key === attempt.id + ":" + attempt.current ? resolved : null;
  const questionAssets = loaded?.assets || attempt.assets;
  const hydrating = !!attempt.questions[attempt.current].nativeRef && !loaded;
  const q = loaded?.question || attempt.questions[attempt.current],
    selected = attempt.answers[attempt.current],
    key = answerIndex(q),
    subjects = [...grouped.keys()],
    indexes = grouped.get(q.subject) || [],
    number = subjectQuestionPosition(indexes, attempt.current),
    total = indexes.length,
    following = subjects[subjects.indexOf(q.subject) + 1],
    summary = totals!,
    marked = bookmarkIds.has(bookmarkIdentity(attempt.bundleId, q)),
    navigatorIndexes = orderedIndexes.filter(
      (i) =>
        review ||
        navigatorFilter === "all" ||
        (navigatorFilter === "answered"
          ? questionAnswered(attempt, i)
          : !questionAnswered(attempt, i)),
    );
  async function go(index: number) {
    if (
      busy ||
      submitLock.current ||
      questionNavigation.current ||
      !attempt!.questions[index]
    )
      return false;
    questionNavigation.current = true;
    try {
      await workingFlush.current?.();
      if (submitLock.current) return false;
      subjectPositions.current.set(q.subject, attempt!.current);
      update({ current: index });
      return true;
    } catch {
      setError(
        "Your working could not be saved. Retry before changing questions.",
      );
      return false;
    } finally {
      questionNavigation.current = false;
    }
  }
  function switchSubject(subject: string) {
    const list = grouped.get(subject) || [];
    const remembered = subjectPositions.current.get(subject);
    if (list.length)
      go(
        remembered !== undefined && list.includes(remembered)
          ? remembered
          : list[0],
      );
  }
  function advance() {
    const next = adjacentQuestion(orderedIndexes, attempt!.current, 1);
    if (next !== null) go(next);
    else if (review) navigation.goBack();
    else setFinish(true);
  }
  const writtenPaper = attempt.questions.every(isWrittenQuestion);
  const theory = isWrittenQuestion(q),
    reveal =
      review ||
      (theory &&
        attempt.mode === "practice" &&
        (attempt.revealed?.[attempt.current] || selected !== null)),
    solution = theorySolution(q),
    location = theory ? theoryLocation(q) : null;
  return (
    <Screen
      style={
        sideTools && board
          ? { paddingRight: 320 + insets.right, paddingLeft: insets.left }
          : undefined
      }
    >
      <View
        style={{
          minHeight: 68,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: palette.examHeader,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 18 }}>
          {review
            ? "Review"
            : theory
              ? "Theory"
              : attempt.mode === "full"
                ? "Exam"
                : "Practice"}
        </Text>
        <View style={{ flex: 1 }} />
        {review ? (
          <Button kind="secondary" onPress={() => navigation.goBack()}>
            <Check size={17} color={palette.ink} />
            <Text style={{ fontFamily: fonts.mono }}>Complete</Text>
          </Button>
        ) : (
          <>
            <ExamClock
              deadline={attempt.deadline}
              duration={attempt.duration}
              onExpire={() => void submit()}
            />
            <Button kind="secondary" onPress={() => setFinish(true)}>
              <Text style={{ fontSize: 10 }}>Finish</Text>
              <ArrowRight size={14} color={palette.ink} />
            </Button>
          </>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: palette.examHeader }}
        contentContainerStyle={{
          flexDirection: "row",
          minWidth: "100%",
          paddingVertical: 4,
          paddingHorizontal: 12,
          gap: 6,
          backgroundColor: palette.examHeader,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
        }}
      >
        {subjects.map((subject) => (
          <Pressable
            key={subject}
            onPress={() => switchSubject(subject)}
            accessibilityRole="tab"
            accessibilityState={{ selected: q.subject === subject }}
            style={{
              flexGrow: 1,
              minWidth: 112,
              minHeight: 44,
              padding: 8,
              borderBottomWidth: 2,
              borderBottomColor:
                q.subject === subject ? palette.accent : "transparent",
              backgroundColor:
                q.subject === subject ? palette.wash : "transparent",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                textAlign: "center",
                fontFamily: fonts.semibold,
                color: q.subject === subject ? palette.accent : palette.muted,
              }}
            >
              {subject}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {review ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            flexGrow: 0,
            borderBottomWidth: 1,
            borderColor: palette.line,
          }}
          contentContainerStyle={{
            flexDirection: "row",
            paddingHorizontal: 12,
            gap: 4,
            paddingVertical: 6,
          }}
        >
          {(
            [
              "all",
              ...(writtenPaper
                ? []
                : ["correct" as const, "incorrect" as const]),
              "skipped",
              ...(summary.ungraded ? ["reviewed" as const] : []),
              "saved",
            ] as const
          ).map((filter) => (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === reviewFilter }}
              onPress={() => setReviewFilter(filter)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                minHeight: 40,
                borderRadius: 8,
                backgroundColor:
                  filter === reviewFilter ? palette.control : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: filter === reviewFilter ? palette.ink : palette.muted,
                }}
              >
                {filter === "incorrect"
                  ? "Wrong"
                  : filter === "skipped"
                    ? "Unanswered"
                    : filter === "reviewed"
                      ? writtenPaper
                        ? "Answered"
                        : "Not marked"
                      : filter[0].toUpperCase() + filter.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 2,
          minHeight: 48,
          borderBottomWidth: 1,
          borderColor: palette.line,
          backgroundColor: palette.examRail,
        }}
      >
        <IconButton
          label="Decrease question text"
          disabled={scale <= 0.9}
          onPress={() => setScale((v) => Math.max(0.9, v - 0.1))}
          style={{ width: 44, height: 44 }}
        >
          <Minus size={15} color={palette.muted} />
        </IconButton>
        <IconButton
          label="Increase question text"
          disabled={scale >= 1.4}
          onPress={() => setScale((v) => Math.min(1.4, v + 0.1))}
          style={{ width: 44, height: 44 }}
        >
          <Plus size={15} color={palette.muted} />
        </IconButton>
        <IconButton
          label={marked ? "Remove saved question" : "Save question"}
          active={marked}
          disabled={bookmarkBusy || hydrating}
          onPress={() => {
            setBookmarkBusy(true);
            void toggleBookmark(
              owner,
              {
                id: attempt.bundleId,
                title: attempt.title,
                assets: questionAssets,
              },
              q,
            )
              .then(refreshPractice)
              .catch((e) => setError(e.message))
              .finally(() => setBookmarkBusy(false));
          }}
          style={{ width: 44, height: 44 }}
        >
          <Bookmark
            size={17}
            color={marked ? palette.accent : palette.muted}
            fill={marked ? palette.accent : "none"}
          />
        </IconButton>
        <QuestionReport
          bundleId={attempt.bundleId}
          version={attempt.version}
          question={q}
        />
        <IconButton
          label="Toggle calculator"
          active={calculator}
          onPress={() => {
            void (async () => {
              try {
                await workingFlush.current?.();
                setBoard(false);
                setCalculator((v) => !v);
              } catch {
                setError("Save your working before opening the calculator.");
              }
            })();
          }}
          style={{ width: 44, height: 44 }}
        >
          <CalculatorIcon
            size={17}
            color={calculator ? palette.accent : palette.muted}
          />
        </IconButton>
        <IconButton
          label="Toggle working paper"
          active={board}
          onPress={() => {
            setCalculator(false);
            if (board)
              void workingFlush
                .current?.()
                .then(() => setBoard(false))
                .catch(() =>
                  setError("Save your working before closing the board."),
                );
            else setBoard(true);
          }}
          style={{ width: 44, height: 44 }}
        >
          <PenLine size={17} color={board ? palette.accent : palette.muted} />
        </IconButton>
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        {questionError ? (
          <View>
            <ErrorText>{questionError}</ErrorText>
            <Button kind="text" onPress={() => setLoadRevision((v) => v + 1)}>
              Retry question
            </Button>
          </View>
        ) : null}
        {error ? (
          <View>
            <ErrorText>{error}</ErrorText>
            <Button
              kind="text"
              onPress={() =>
                void Promise.resolve()
                  .then(() => workingFlush.current?.())
                  .then(() => saveAttempt(latest.current!))
                  .then(() => setError(""))
                  .catch(() => {})
              }
            >
              Retry save
            </Button>
          </View>
        ) : null}
        <View style={{ flex: 1, minHeight: 0 }}>
          <QuestionSwipeSurface
            questionKey={attempt.id + ":" + attempt.current}
            enabled={
              !busy &&
              !writingFocused &&
              !hydrating &&
              !finish &&
              !navigator &&
              !leaving &&
              (!review || reviewIndexes.length > 0)
            }
            onSwipe={(direction) => {
              const target = adjacentQuestion(
                orderedIndexes,
                attempt.current,
                direction,
              );
              if (target !== null) go(target);
            }}
          >
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingTop: 17,
                paddingHorizontal: 20,
                paddingBottom: 24,
                maxWidth: 790,
                width: "100%",
                alignSelf: "center",
              }}
            >
              {review && !reviewIndexes.length ? (
                <Empty title="No matching questions." />
              ) : (
                <>
                  {review ? (
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: fonts.semibold,
                        marginBottom: 14,
                        color:
                          questionOutcome(attempt, attempt.current) ===
                          "correct"
                            ? palette.correct
                            : questionOutcome(attempt, attempt.current) ===
                                "incorrect"
                              ? palette.incorrect
                              : palette.muted,
                      }}
                    >
                      {questionOutcome(attempt, attempt.current) === "correct"
                        ? "✓ "
                        : questionOutcome(attempt, attempt.current) ===
                            "incorrect"
                          ? "× "
                          : "— "}
                      {outcomeLabel[questionOutcome(attempt, attempt.current)]}
                    </Text>
                  ) : null}
                  {theory ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 18,
                      }}
                    >
                      <Text
                        style={{ fontFamily: fonts.semibold, fontSize: 17 }}
                      >
                        {theoryLabel(q, attempt.current)}
                      </Text>
                      {location ? (
                        <Muted>
                          {[
                            location.section,
                            location.marks
                              ? location.marks +
                                (location.marks === "1" ? " mark" : " marks")
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Muted>
                      ) : null}
                    </View>
                  ) : null}
                  <QuestionMedia
                    passage={q.passage}
                    figures={q.figures}
                    assets={questionAssets}
                  />
                  <View style={{ marginBottom: 24 }}>
                    {typeof q.nativeRef === "string" && !loaded ? (
                      <Loading label="Opening question" />
                    ) : null}
                    <RichText
                      text={q.question}
                      html={q.questionHtml}
                      assets={questionAssets}
                      size={18 * scale}
                      serif
                    />
                  </View>
                  {theory && (!review || attempt.written[attempt.current]) ? (
                    <View style={{ gap: 8, marginVertical: 18 }}>
                      <Muted>Answer {theoryLabel(q, attempt.current)}</Muted>
                      <TextInput
                        multiline
                        onFocus={() => setWritingFocused(true)}
                        onBlur={() => setWritingFocused(false)}
                        editable={!review && !hydrating && !busy}
                        accessibilityLabel={
                          "Your answer to " + theoryLabel(q, attempt.current)
                        }
                        placeholder="Write your answer…"
                        placeholderTextColor={palette.faint}
                        value={attempt.written[attempt.current] || ""}
                        onChangeText={(text) => {
                          const written = [...attempt.written];
                          written[attempt.current] = text;
                          update({ written });
                        }}
                        style={{
                          minHeight: 160,
                          borderWidth: 1,
                          borderColor: palette.line,
                          borderRadius: 8,
                          padding: 12,
                          color: palette.ink,
                          fontFamily: fonts.body,
                          fontSize: 16,
                          textAlignVertical: "top",
                        }}
                      />
                    </View>
                  ) : null}
                  {!theory && !hydrating ? (
                    <View style={{ gap: 10 }}>
                      {q.options.map((option, i) => (
                        <Pressable
                          key={i}
                          disabled={review || hydrating || busy}
                          accessibilityRole="radio"
                          accessibilityLabel={[
                            String.fromCharCode(65 + i),
                            option,
                            review && key === i ? "Correct answer" : "",
                            review && selected === i ? "Your answer" : "",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                          accessibilityState={{ selected: selected === i }}
                          onPress={() => {
                            const answers = [...attempt.answers];
                            answers[attempt.current] = i;
                            update({ answers });
                          }}
                          style={{
                            minHeight: 61,
                            paddingVertical: 12,
                            paddingLeft: 10,
                            paddingRight: 14,
                            gap: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            borderWidth: 1,
                            borderRadius: 6,
                            borderColor:
                              review && key === i
                                ? palette.correct
                                : review && selected === i && key !== null
                                  ? palette.incorrect
                                  : selected === i
                                    ? palette.accent
                                    : palette.line,
                            backgroundColor:
                              review && key === i
                                ? palette.correctWash
                                : review && selected === i && key !== null
                                  ? palette.incorrectWash
                                  : selected === i
                                    ? palette.accentWash
                                    : palette.wash,
                            borderStyle: "solid",
                          }}
                        >
                          <View
                            style={{
                              width: 29,
                              height: 29,
                              borderWidth: 1,
                              borderColor:
                                review && key === i
                                  ? palette.correct
                                  : review && selected === i && key !== null
                                    ? palette.incorrect
                                    : selected === i
                                      ? palette.accent
                                      : palette.line,
                              borderRadius: 4,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor:
                                review && key === i
                                  ? palette.correctWash
                                  : review && selected === i && key !== null
                                    ? palette.incorrectWash
                                    : selected === i
                                      ? palette.accent
                                      : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color:
                                  review && key === i
                                    ? palette.correct
                                    : review && selected === i && key !== null
                                      ? palette.incorrect
                                      : selected === i
                                        ? palette.bg
                                        : palette.muted,
                              }}
                            >
                              {String.fromCharCode(65 + i)}
                            </Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <RichText
                              text={option}
                              html={q.optionsHtml?.[i]}
                              assets={questionAssets}
                              size={13 * scale}
                            />
                          </View>
                          {review && key === i ? (
                            <Check size={16} color={palette.correct} />
                          ) : review && selected === i && key !== null ? (
                            <X size={16} color={palette.incorrect} />
                          ) : selected === i ? (
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 2,
                                backgroundColor: palette.accent,
                              }}
                            />
                          ) : null}
                          {review && selected === i ? (
                            <Muted
                              style={{
                                fontSize: 10,
                                maxWidth: 55,
                                textAlign: "right",
                              }}
                            >
                              Your answer
                            </Muted>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {theory &&
                  !review &&
                  attempt.mode === "practice" &&
                  !reveal ? (
                    <Button
                      onPress={() => {
                        const revealed = [...(attempt.revealed || [])];
                        revealed[attempt.current] = true;
                        update({ revealed });
                      }}
                      style={{ marginTop: 32 }}
                    >
                      Show source answer
                    </Button>
                  ) : null}
                  {reveal ? (
                    <View
                      style={{
                        marginTop: 25,
                        paddingTop: 20,
                        borderTopWidth: 1,
                        borderTopColor: palette.accent,
                      }}
                    >
                      {q.topic ? (
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 8,
                            marginBottom: 14,
                          }}
                        >
                          <Muted>Topic</Muted>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: fonts.semibold,
                            }}
                          >
                            {String(q.topic)}
                          </Text>
                        </View>
                      ) : null}
                      {theory && (solution.text || solution.html) ? (
                        <>
                          <Text
                            style={{
                              fontSize: 14,
                              fontFamily: fonts.semibold,
                              marginBottom: 18,
                              color: palette.muted,
                            }}
                          >
                            Source answer
                          </Text>
                          <RichText
                            text={solution.text}
                            html={solution.html}
                            assets={questionAssets}
                            size={13}
                          />
                        </>
                      ) : null}
                      <RichText
                        text={
                          theory
                            ? solution.explanation ||
                              (!solution.text && !solution.html
                                ? "No source answer available."
                                : "")
                            : q.explanation
                        }
                        html={
                          theory ? solution.explanationHtml : q.explanationHtml
                        }
                        assets={questionAssets}
                        size={13}
                      />
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          </QuestionSwipeSurface>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
              paddingTop: 12,
              paddingBottom: Math.max(12, insets.bottom),
              paddingHorizontal: 16,
              borderTopWidth: 1,
              borderTopColor: palette.line,
            }}
          >
            <Button
              kind="secondary"
              disabled={
                adjacentQuestion(orderedIndexes, attempt.current, -1) === null
              }
              onPress={() => {
                const target = adjacentQuestion(
                  orderedIndexes,
                  attempt.current,
                  -1,
                );
                if (target !== null) go(target);
              }}
            >
              <ArrowLeft size={15} color={palette.ink} />
              <Text style={{ fontSize: 11 }}>Previous</Text>
            </Button>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open question navigator"
              onPress={() => {
                setNavigatorFilter("all");
                setNavigator(true);
              }}
              style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
            >
              <Grid2X2 size={14} color={palette.muted} />
              <Muted style={{ fontSize: 10 }}>
                {theory
                  ? theoryLabel(q, attempt.current)
                  : `${review ? attempt.current + 1 : number}/${review ? attempt.questions.length : total}`}
              </Muted>
            </Pressable>
            <Button arrow onPress={advance}>
              {number < total
                ? "Next"
                : following
                  ? "Next subject"
                  : review
                    ? "Complete"
                    : "Finish exam"}
            </Button>
          </View>
        </View>
      </View>
      <View
        style={
          sideTools && board
            ? {
                position: "absolute",
                top: insets.top,
                bottom: 0,
                right: insets.right,
                width: 320,
              }
            : undefined
        }
      >
        {board ? (
          <DrawingBoard
            key={attempt.id + ":" + attempt.current}
            side={sideTools}
            attemptId={attempt.id}
            questionIndex={attempt.current}
            readOnly={review || attempt.status === "completed"}
            flushRef={workingFlush}
            onClose={() => setBoard(false)}
          />
        ) : null}
      </View>
      {calculator ? (
        <FloatingCalculator
          savedFrame={calculatorFrame}
          onClose={() => setCalculator(false)}
        />
      ) : null}
      {navigator ? (
        <Dialog
          title={theory ? "Questions & parts" : "Question numbers"}
          onClose={() => setNavigator(false)}
        >
          {!review ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              {(["all", "answered", "skipped"] as const).map((filter) => (
                <Button
                  key={filter}
                  kind={navigatorFilter === filter ? "secondary" : "text"}
                  onPress={() => setNavigatorFilter(filter)}
                >
                  {filter === "skipped"
                    ? "Unanswered"
                    : filter[0].toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </View>
          ) : null}
          <QuestionNumbers
            attempt={attempt}
            indexes={navigatorIndexes}
            review={review}
            current={attempt.current}
            onSelect={(i) => {
              void go(i).then((ok) => {
                if (ok) setNavigator(false);
              });
            }}
          />
          {!review ? (
            <Button
              kind="secondary"
              disabled={!summary.skipped}
              onPress={() => {
                const offset = orderedIndexes.indexOf(attempt.current) + 1;
                const next = [
                  ...orderedIndexes.slice(offset),
                  ...orderedIndexes.slice(0, offset),
                ].find((i) => !questionAnswered(attempt, i));
                if (next !== undefined)
                  void go(next).then((ok) => {
                    if (ok) setNavigator(false);
                  });
              }}
              style={{ marginTop: 14 }}
            >
              Next unanswered
            </Button>
          ) : null}
          <Button
            onPress={() => {
              setNavigator(false);
              review ? navigation.goBack() : setFinish(true);
            }}
            style={{ marginTop: 12 }}
          >
            {review ? "Close review" : "Finish exam"}
          </Button>
        </Dialog>
      ) : null}
      {finish && !review ? (
        <Dialog
          title="Ready to finish?"
          onClose={() => {
            if (!busy) setFinish(false);
          }}
        >
          {summary.skipped > 0 ? (
            <Muted style={{ marginBottom: 24 }}>
              {summary.skipped} question
              {summary.skipped === 1 ? " is" : "s are"} still unanswered.
            </Muted>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 24,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: palette.line,
            }}
          >
            {[
              {
                value: summary.answered,
                label: "Answered",
                filter: "answered" as const,
              },
              {
                value: summary.skipped,
                label: "Remaining",
                filter: "skipped" as const,
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={
                  "Show " +
                  item.value +
                  " " +
                  item.label.toLowerCase() +
                  " questions"
                }
                onPress={() => {
                  setNavigatorFilter(item.filter);
                  setFinish(false);
                  setNavigator(true);
                }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 5,
                  paddingVertical: 8,
                }}
              >
                <Title size={28}>{item.value}</Title>
                <Muted style={{ fontSize: 10 }}>{item.label}</Muted>
              </Pressable>
            ))}
          </View>
          <Button
            arrow
            busy={busy}
            onPress={() => void submit()}
            style={{ marginTop: 25 }}
          >
            Submit exam
          </Button>
          <Button
            kind="secondary"
            disabled={busy}
            onPress={() => setFinish(false)}
            style={{ marginTop: 12 }}
          >
            Keep working
          </Button>
        </Dialog>
      ) : null}
      {leaveDialog()}
    </Screen>
  );
}
