import { resolveQuestion } from "../storage/bank";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Bookmark from "lucide-react-native/icons/bookmark";
import BookOpen from "lucide-react-native/icons/book-open";
import CalculatorIcon from "lucide-react-native/icons/calculator";
import Check from "lucide-react-native/icons/check";
import Flag from "lucide-react-native/icons/flag";
import Grid2X2 from "lucide-react-native/icons/grid-2x2";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import PenLine from "lucide-react-native/icons/pen-line";
import X from "lucide-react-native/icons/x";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Wordmark,
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
import { adjacentQuestion } from "../domain/swipe";
import ExamClock from "../components/ExamClock";
import RichText from "../components/RichText";
import QuestionMedia from "../components/QuestionMedia";
import QuestionReport from "../components/QuestionReport";
import { Calculator, DrawingBoard } from "../components/StudyTools";
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
  subjectAnsweredCount,
} from "../domain/subjectNavigation";
import { syncHistory } from "../services/history";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Attempt } from "../domain/types";
import type { Props } from "../navigation/types";
export default function ExamScreen({ route, navigation }: Props<"Exam">) {
  const { owner, palette, bookmarks, refreshPractice, syncNow } = useApp(),
    insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [error, setError] = useState(""),
    [navigator, setNavigator] = useState(false),
    [finish, setFinish] = useState(false),
    [calculator, setCalculator] = useState(false),
    [board, setBoard] = useState(false),
    [scale, setScale] = useState(1),
    [reviewFilter, setReviewFilter] = useState<
      "all" | "incorrect" | "skipped" | "saved"
    >("all"),
    [leaving, setLeaving] = useState<(() => void) | null>(null),
    [busy, setBusy] = useState(false),
    [bookmarkBusy, setBookmarkBusy] = useState(false);
  const latest = useRef<Attempt | null>(null),
    submitLock = useRef(false),
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
      .then((a) => {
        if (active) {
          latest.current = a;
          setAttempt(a);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [owner, route.params.attemptId]);
  usePreventRemove(
    !!attempt && !review && attempt.status === "active",
    ({ data }) => setLeaving(() => () => navigation.dispatch(data.action)),
  );
  function update(value: Partial<Attempt>) {
    if (!latest.current) return;
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
  async function submit() {
    if (submitLock.current || !latest.current || review) return;
    submitLock.current = true;
    setBusy(true);
    try {
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
  const reviewIndexes = useMemo(
    () =>
      attempt
        ? attempt.questions.flatMap((q, i) =>
            !review ||
            reviewFilter === "all" ||
            (reviewFilter === "incorrect" &&
              answerIndex(q) !== null &&
              attempt.answers[i] != null &&
              attempt.answers[i] !== answerIndex(q)) ||
            (reviewFilter === "skipped" && !questionAnswered(attempt, i)) ||
            (reviewFilter === "saved" &&
              bookmarkIds.has(bookmarkIdentity(attempt.bundleId, q)))
              ? [i]
              : [],
          )
        : [],
    [
      attempt?.questions,
      attempt?.answers,
      attempt?.written,
      review,
      reviewFilter,
      bookmarks,
    ],
  );
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
  if (!attempt)
    return (
      <Screen>
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <Loading label="Opening your saved exam" />
        )}
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
    answered = subjectAnsweredCount(indexes, attempt.answers, attempt.written),
    following = subjects[subjects.indexOf(q.subject) + 1],
    summary = totals!,
    marked = bookmarkIds.has(bookmarkIdentity(attempt.bundleId, q));
  function go(index: number) {
    subjectPositions.current.set(q.subject, attempt!.current);
    update({ current: index });
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
    else if (review) navigation.navigate("Main", { tab: "library" });
    else setFinish(true);
  }
  const theory = q.type === "theory" || q.type === "short_answer",
    reveal = review || (q.type === "theory" && selected !== null);
  return (
    <Screen>
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
        <Wordmark />
        <View style={{ flex: 1 }} />
        {review ? (
          <Button
            kind="secondary"
            onPress={() => navigation.navigate("Main", { tab: "library" })}
          >
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
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
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
              flexBasis: 130,
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
      </View>
      {review ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 16,
            gap: 6,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
          }}
        >
          {(["all", "incorrect", "skipped", "saved"] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setReviewFilter(filter)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 40,
                borderRadius: 8,
                backgroundColor:
                  filter === reviewFilter ? palette.control : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: filter === reviewFilter ? palette.ink : palette.muted,
                }}
              >
                {filter[0].toUpperCase() + filter.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ height: 2, backgroundColor: palette.wash }}>
        <View
          style={{
            height: 2,
            width: ((total ? (answered / total) * 100 : 0) +
              "%") as `${number}%`,
            backgroundColor: palette.accent,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 16,
          gap: 14,
          minHeight: 50,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
          backgroundColor: palette.examRail,
        }}
      >
        <Pressable
          onPress={() => setNavigator(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            paddingHorizontal: 9,
            borderWidth: 1,
            borderColor: palette.line,
            borderRadius: 6,
          }}
        >
          <Grid2X2 size={16} color={palette.muted} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 12 }}>{number}</Text>
          <Muted style={{ fontSize: 9 }}>of {total}</Muted>
        </Pressable>
        <View style={{ height: 20, width: 1, backgroundColor: palette.line }} />
        <Pressable
          onPress={() => setCalculator((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            minHeight: 44,
          }}
        >
          <CalculatorIcon size={17} color={palette.muted} />
          <Muted style={{ fontSize: 10 }}>Calculator</Muted>
        </Pressable>
        <Pressable
          onPress={() => setBoard((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            minHeight: 44,
          }}
        >
          <PenLine size={17} color={palette.muted} />
          <Muted style={{ fontSize: 10 }}>Working</Muted>
        </Pressable>
      </View>
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
              void saveAttempt(latest.current!)
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
            !hydrating &&
            !finish &&
            !navigator &&
            !calculator &&
            !board &&
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
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 3,
                    marginBottom: 16,
                  }}
                >
                  <QuestionReport
                    bundleId={attempt.bundleId}
                    version={attempt.version}
                    question={q}
                  />
                  <IconButton
                    label="Decrease question text"
                    disabled={scale <= 0.9}
                    onPress={() => setScale((v) => Math.max(0.9, v - 0.1))}
                    style={{ width: 32, height: 34 }}
                  >
                    <Minus size={15} color={palette.muted} />
                  </IconButton>
                  <IconButton
                    label="Increase question text"
                    disabled={scale >= 1.4}
                    onPress={() => setScale((v) => Math.min(1.4, v + 0.1))}
                    style={{ width: 32, height: 34 }}
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
                    style={{ width: 32, height: 34 }}
                  >
                    <Bookmark
                      size={18}
                      color={marked ? palette.accent : palette.muted}
                      fill={marked ? palette.accent : "none"}
                    />
                  </IconButton>
                  {!review ? (
                    <IconButton
                      label={
                        attempt.flagged[attempt.current]
                          ? "Unflag question"
                          : "Flag question"
                      }
                      active={attempt.flagged[attempt.current]}
                      onPress={() => {
                        const flagged = [...attempt.flagged];
                        flagged[attempt.current] = !flagged[attempt.current];
                        update({ flagged });
                      }}
                      style={{ width: 32, height: 34 }}
                    >
                      <Flag size={18} color={palette.muted} />
                    </IconButton>
                  ) : null}
                </View>
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
                    <Muted>
                      {q.type === "theory"
                        ? "Your working (optional)"
                        : "Your answer"}
                    </Muted>
                    <TextInput
                      multiline
                      editable={!review && !hydrating}
                      accessibilityLabel="Your answer"
                      placeholder="Type your answer"
                      placeholderTextColor={palette.faint}
                      value={attempt.written[attempt.current] || ""}
                      onChangeText={(text) => {
                        const written = [...attempt.written];
                        written[attempt.current] = text;
                        update({ written });
                      }}
                      style={{
                        minHeight: 100,
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
                        disabled={review || hydrating}
                        accessibilityRole="radio"
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
                            selected === i
                              ? palette.accent
                              : review && key === i
                                ? palette.done
                                : palette.line,
                          backgroundColor:
                            selected === i ? palette.accentWash : palette.wash,
                          borderStyle:
                            review &&
                            selected === i &&
                            key !== null &&
                            key !== i
                              ? "dashed"
                              : "solid",
                        }}
                      >
                        <View
                          style={{
                            width: 29,
                            height: 29,
                            borderWidth: 1,
                            borderColor:
                              selected === i
                                ? palette.accent
                                : review && key === i
                                  ? palette.done
                                  : palette.line,
                            borderRadius: 4,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor:
                              review && key === i
                                ? palette.done
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
                                  ? palette.onDone
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
                          <Check size={16} color={palette.done} />
                        ) : review && selected === i && key !== null ? (
                          <X size={16} color={palette.accent} />
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
                              fontSize: 8,
                              maxWidth: 45,
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
                {q.type === "theory" && !reveal ? (
                  <Button
                    onPress={() => {
                      const answers = [...attempt.answers];
                      answers[attempt.current] = 0;
                      update({ answers });
                    }}
                    style={{ marginTop: 32 }}
                  >
                    I’ve solved it — show answer
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
                          style={{ fontSize: 12, fontFamily: fonts.semibold }}
                        >
                          {String(q.topic)}
                        </Text>
                      </View>
                    ) : null}
                    {theory && (q.answerText || q.answerHtml) ? (
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
                          text={q.answerText || ""}
                          html={q.answerHtml}
                          assets={questionAssets}
                          size={13}
                        />
                      </>
                    ) : null}
                    <RichText
                      text={
                        q.explanation ||
                        (q.type === "theory" && !q.answerText
                          ? "No answer was supplied for this question."
                          : "")
                      }
                      html={q.explanationHtml}
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
            onPress={() => setNavigator(true)}
            style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
          >
            <Grid2X2 size={14} color={palette.muted} />
            <Muted style={{ fontSize: 10 }}>
              {number}/{total}
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
      {board ? (
        <DrawingBoard
          question={String(attempt.current)}
          onClose={() => setBoard(false)}
        />
      ) : null}
      {navigator ? (
        <Dialog
          title={q.subject + " questions"}
          onClose={() => setNavigator(false)}
        >
          <Muted>
            {answered} of {total} answered
          </Muted>
          <Muted style={{ fontSize: 9, marginVertical: 20 }}>
            Answered Unanswered ⚑ Flagged
          </Muted>
          <FlatList
            data={indexes}
            numColumns={5}
            keyExtractor={(i) => String(i)}
            style={{ maxHeight: 350 }}
            renderItem={({ item, index }) => (
              <Pressable
                accessibilityLabel={"Question " + (index + 1)}
                onPress={() => {
                  go(item);
                  setNavigator(false);
                }}
                style={{
                  width: "18%",
                  margin: "1%",
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor:
                    attempt.current === item ? palette.accent : palette.line,
                  borderRadius: 5,
                  backgroundColor: questionAnswered(attempt, item)
                    ? palette.done
                    : palette.control,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    color: questionAnswered(attempt, item)
                      ? palette.onDone
                      : palette.ink,
                  }}
                >
                  {index + 1}
                  {attempt.flagged[item] ? " ⚑" : ""}
                </Text>
              </Pressable>
            )}
          />
          <Button
            kind="secondary"
            disabled={answered === total}
            onPress={() => {
              const next = [
                ...indexes.slice(number),
                ...indexes.slice(0, number),
              ].find((i) => !questionAnswered(attempt, i));
              if (next !== undefined) go(next);
              setNavigator(false);
            }}
            style={{ marginTop: 20 }}
          >
            Next unanswered
          </Button>
          <Button
            onPress={() => {
              setNavigator(false);
              review
                ? navigation.navigate("Main", { tab: "library" })
                : setFinish(true);
            }}
            style={{ marginTop: 12 }}
          >
            {review ? "Complete review" : "Finish exam"}
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
              { value: summary.answered, label: "Answered" },
              { value: summary.skipped, label: "Remaining" },
              {
                value: attempt.flagged.filter(Boolean).length,
                label: "Flagged",
              },
            ].map((item) => (
              <View
                key={item.label}
                style={{ flex: 1, alignItems: "center", gap: 5 }}
              >
                <Title size={28}>{item.value}</Title>
                <Muted style={{ fontSize: 10 }}>{item.label}</Muted>
              </View>
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
      {leaving ? (
        <Dialog title="Leave this exam?" onClose={() => setLeaving(null)}>
          <Muted>
            Your answers are saved. You can resume from Past sessions. The exam
            clock keeps running.
          </Muted>
          <Button
            kind="secondary"
            onPress={() => setLeaving(null)}
            style={{ marginTop: 20 }}
          >
            Keep working
          </Button>
          <Button
            onPress={() => {
              const leave = leaving;
              setLeaving(null);
              leave();
            }}
            style={{ marginTop: 12 }}
          >
            Save and leave
          </Button>
        </Dialog>
      ) : null}
      {calculator ? <Calculator onClose={() => setCalculator(false)} /> : null}
    </Screen>
  );
}
