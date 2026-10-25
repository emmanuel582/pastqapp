import {
  normalizeUploadQuestion,
  uploadQuestionIssues,
  needsQuestionCheck,
  applyUploadEdit,
  hasOpenUploadChecks,
} from "../domain/uploadReview";
import { rememberUpload } from "../services/uploadHistory";
import RichText from "../components/RichText";
import { isWrittenQuestion, theoryLabel } from "../domain/theory";
import { confirmedMaterial } from "../services/confirmedMaterial";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, ScrollView, Pressable } from "react-native";
import Edit2 from "lucide-react-native/icons/pen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Text,
  Muted,
  Button,
  IconButton,
  Field,
  ErrorText,
  Dialog,
  Loading,
  Row,
} from "../components/ui";
import QuestionMedia from "../components/QuestionMedia";
import Select from "../components/Select";
import { visionSession, confirmMaterial } from "../services/uploads";
import { saveBundle } from "../services/library";
import * as records from "../storage/records";
import type { Question, VisionSession } from "../domain/types";
import type { Props } from "../navigation/types";
import { fonts } from "../theme/tokens";
export default function ReviewMaterialScreen({
  route,
  navigation,
}: Props<"ReviewMaterial">) {
  const { owner, palette, refreshSaved, refreshLibrary } = useApp(),
    insets = useSafeAreaInsets();
  const [session, setSession] = useState<VisionSession | null>(null),
    [questions, setQuestions] = useState<Question[]>([]),
    [selected, setSelected] = useState("all"),
    [expanded, setExpanded] = useState<number | null>(null),
    [editing, setEditing] = useState<number | null>(null),
    [draft, setDraft] = useState<Question | null>(null),
    [busy, setBusy] = useState(false),
    [editError, setEditError] = useState(""),
    [error, setError] = useState(""),
    [removed, setRemoved] = useState<{ q: Question; i: number } | null>(null);
  const saveLock = useRef(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const cached = await records.read<VisionSession>(
            owner,
            "vision-session",
            route.params.sessionId,
          ),
          value = await visionSession(route.params.sessionId).catch((error) => {
            if (
              cached?.questions?.length &&
              ["completed", "completed_with_errors", "confirmed"].includes(
                cached.status,
              )
            )
              return cached;
            throw error;
          });
        if (active) {
          const confirmed = await confirmedMaterial(owner, value);
          if (!active) return;
          if (confirmed) {
            navigation.replace("Setup", { bundleId: confirmed });
            return;
          }
          if (
            hasOpenUploadChecks(value) ||
            !["completed", "completed_with_errors", "confirmed"].includes(
              value.status,
            ) ||
            !value.questions?.length
          ) {
            navigation.replace("Processing", {
              sessionId: route.params.sessionId,
            });
            return;
          }
          await records.write(owner, "vision-session", value.id, value);
          if (!active) return;
          setSession(value);
          const saved = await records.read<{
            sourceUpdatedAt?: number;
            questions: Question[];
          }>(owner, "material-review", value.id);
          if (!active) return;
          setQuestions(
            (saved && saved.sourceUpdatedAt === value.updatedAt
              ? saved.questions
              : value.questions || []
            ).map(normalizeUploadQuestion),
          );
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not open your questions.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [route.params.sessionId, owner]);
  const groups = useMemo(
      () => [
        ...new Set(
          questions.map((q) =>
            String(
              q.section ||
                [q.year || "Unknown", q.paper || "Default"].join(" · "),
            ),
          ),
        ),
      ],
      [questions],
    ),
    visible = questions.flatMap((q, i) =>
      selected === "all" ||
      String(
        q.section || [q.year || "Unknown", q.paper || "Default"].join(" · "),
      ) === selected
        ? [{ q, i }]
        : [],
    );
  const minimumOptions = (q: Question) => (isWrittenQuestion(q) ? 0 : 2);
  const checks = questions.flatMap((q, i) =>
    needsQuestionCheck(q) ? [{ q, i }] : [],
  );
  const blocking = checks;
  useEffect(() => {
    if (session && questions.length)
      void records
        .write(owner, "material-review", session.id, {
          sourceUpdatedAt: session.updatedAt,
          questions,
        })
        .catch(() => {});
  }, [owner, session?.id, questions]);
  async function save() {
    if (saveLock.current || blocking.length || !questions.length) return;
    saveLock.current = true;
    setBusy(true);
    setError("");
    try {
      const bundle = await confirmMaterial(
        route.params.sessionId,
        questions.map(normalizeUploadQuestion),
      );
      await saveBundle(owner, { ...bundle, ownerId: owner });
      await records.write(
        owner,
        "confirmed-material",
        route.params.sessionId,
        bundle.id,
      );
      await records.write(owner, "remote-material", bundle.id, {
        ...bundle,
        ownerId: owner,
        questions: [],
      });
      await rememberUpload(owner, {
        ...session!,
        questions: bundle.questions,
        status: "completed",
        approvedAt:
          typeof bundle.approvedAt === "string"
            ? bundle.approvedAt
            : new Date().toISOString(),
      });
      await records.remove(owner, "material-review", route.params.sessionId);
      await records.remove(owner, "processing", "current");
      await refreshSaved();
      void refreshLibrary();
      navigation.replace("Setup", { bundleId: bundle.id });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }
  function saveEdit() {
    if (editing === null || !draft) return;
    const next = applyUploadEdit(draft);
    const issues = uploadQuestionIssues(next);
    if (issues.length) {
      setEditError(issues[0]);
      return;
    }
    setEditError("");
    setQuestions((old) => old.map((q, i) => (i === editing ? next : q)));
    setEditing(null);
    setDraft(null);
  }
  if (!session)
    return (
      <Screen>{error ? <ErrorText>{error}</ErrorText> : <Loading />}</Screen>
    );
  return (
    <Screen>
      <Header
        title={checks.length ? "Check questions" : "Review questions"}
        onBack={() => navigation.popTo("Uploads")}
      />
      {!checks.length && groups.length > 1 ? (
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
            backgroundColor: palette.panel,
          }}
        >
          <ScrollView
            horizontal
            contentContainerStyle={{
              gap: 8,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            {["all", ...groups].map((group) => (
              <Pressable
                key={group}
                onPress={() => setSelected(group)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor:
                    selected === group ? palette.button : palette.line,
                  borderRadius: 20,
                  backgroundColor:
                    selected === group ? palette.button : palette.bg,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: selected === group ? palette.onButton : palette.ink,
                  }}
                >
                  {group === "all" ? "All (" + questions.length + ")" : group}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <FlatList
        data={checks.length ? checks : visible}
        keyExtractor={({ q, i }) => String(q.id) + "-" + i}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 12,
        }}
        ListHeaderComponent={
          removed ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Muted>Question removed</Muted>
              <Button
                kind="text"
                onPress={() => {
                  setQuestions((old) => {
                    const next = [...old];
                    next.splice(removed.i, 0, removed.q);
                    return next;
                  });
                  setRemoved(null);
                }}
              >
                Undo
              </Button>
            </View>
          ) : null
        }
        renderItem={({ item: { q, i } }) => (
          <View
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: palette.line,
              borderRadius: 16,
              backgroundColor: palette.panel,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: palette.accent,
                    backgroundColor: palette.accentWash,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    borderRadius: 8,
                  }}
                >
                  {isWrittenQuestion(q)
                    ? theoryLabel(q, i)
                    : (q.questionNumber ?? i + 1)}
                </Text>
                <Muted style={{ fontSize: 10 }}>{q.subject}</Muted>
                {q.year ? (
                  <Muted style={{ fontSize: 10, color: palette.muted }}>
                    {q.year}
                    {q.paper && q.paper !== "Default" ? " · " + q.paper : ""}
                  </Muted>
                ) : null}
                {needsQuestionCheck(q) ? (
                  <Text
                    style={{
                      fontSize: 10,
                      color: palette.accent,
                      backgroundColor: palette.accentWash,
                      borderRadius: 12,
                      paddingHorizontal: 8,
                    }}
                  >
                    {uploadQuestionIssues(q)[0] || "Check question"}
                  </Text>
                ) : null}
                {q.correct == null && !isWrittenQuestion(q) ? (
                  <Muted style={{ fontSize: 10 }}>No key</Muted>
                ) : null}
                {q.topic ? (
                  <Muted style={{ fontSize: 10, color: palette.muted }}>
                    {String(q.topic)}
                  </Muted>
                ) : null}
              </View>
              <QuestionMedia figures={q.figures} assets={session.assets} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  expanded === i ? "Collapse question" : "Read full question"
                }
                onPress={() => setExpanded(expanded === i ? null : i)}
              >
                {expanded === i ? (
                  <RichText
                    text={q.question}
                    html={q.questionHtml}
                    assets={session.assets}
                    size={14}
                  />
                ) : (
                  <Text
                    numberOfLines={2}
                    style={{
                      fontFamily: fonts.outfit,
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {q.question}
                  </Text>
                )}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
                  {(expanded === i ? q.options : q.options.slice(0, 2)).map(
                    (o, j) => (
                      <Muted key={j} style={{ fontSize: 10 }}>
                        {String.fromCharCode(65 + j)}.{" "}
                        {expanded === i ? o : o.slice(0, 28)}
                        {expanded !== i && o.length > 28 ? "…" : ""}
                      </Muted>
                    ),
                  )}
                </View>
                <Muted
                  style={{ fontSize: 10, marginTop: 8, color: palette.accent }}
                >
                  {expanded === i ? "Show less" : "Read question"}
                </Muted>
              </Pressable>
            </View>
            <IconButton
              label="Edit question"
              onPress={() => {
                setEditError("");
                setEditing(i);
                setDraft({ ...q, options: [...q.options] });
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderColor: palette.line,
                backgroundColor: palette.bg,
              }}
            >
              <Edit2 size={14} color={palette.accent} />
            </IconButton>
          </View>
        )}
      />
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(16, insets.bottom),
          backgroundColor: palette.panel,
          borderTopWidth: 1,
          borderTopColor: palette.line,
        }}
      >
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          disabled={busy || blocking.length > 0 || !questions.length}
          busy={busy}
          onPress={() => void save()}
        >
          {blocking.length
            ? "Fix " +
              blocking.length +
              " question" +
              (blocking.length === 1 ? "" : "s")
            : busy
              ? "Saving…"
              : "Complete"}
        </Button>
      </View>
      {draft && editing !== null ? (
        <Dialog
          title="Edit question"
          onClose={() => {
            setDraft(null);
            setEditing(null);
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 460 }}
          >
            <View style={{ gap: 14 }}>
              <Row
                title="Question type"
                right={
                  <Select
                    label="Question type"
                    value={
                      isWrittenQuestion(draft)
                        ? "written"
                        : draft.type &&
                            [
                              "single_choice",
                              "multiple_choice",
                              "true_false",
                            ].includes(draft.type)
                          ? "choice"
                          : "choose"
                    }
                    options={[
                      { value: "choose", label: "Choose type" },
                      { value: "choice", label: "CBT" },
                      { value: "written", label: "Written" },
                    ]}
                    onChange={(type) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              type:
                                type === "written"
                                  ? "theory"
                                  : type === "choice"
                                    ? "single_choice"
                                    : "other",
                              correct: type === "written" ? null : d.correct,
                              options:
                                type === "choice" && d.options.length < 2
                                  ? [
                                      ...d.options,
                                      ...Array(2 - d.options.length).fill(""),
                                    ]
                                  : d.options,
                            }
                          : d,
                      )
                    }
                  />
                }
              />
              <Field
                label="Subject"
                value={draft.subject}
                onChangeText={(subject) =>
                  setDraft((d) => (d ? { ...d, subject } : d))
                }
              />
              <Field
                label="Question"
                multiline
                value={draft.question}
                onChangeText={(question) =>
                  setDraft((d) =>
                    d ? { ...d, question, questionHtml: undefined } : d,
                  )
                }
                style={{ minHeight: 100, textAlignVertical: "top" }}
              />
              {draft.options.map((option, i) => (
                <Field
                  key={i}
                  label={"Option " + String.fromCharCode(65 + i)}
                  value={option}
                  onChangeText={(text) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            options: d.options.map((o, j) =>
                              j === i ? text : o,
                            ),
                            optionsHtml: undefined,
                          }
                        : d,
                    )
                  }
                />
              ))}
              {minimumOptions(draft) > 0 ? (
                <Button
                  kind="text"
                  onPress={() =>
                    setDraft((d) =>
                      d ? { ...d, options: [...d.options, ""] } : d,
                    )
                  }
                >
                  Add option
                </Button>
              ) : null}
              {!isWrittenQuestion(draft) ? (
                <Row
                  title="Correct answer"
                  right={
                    <Select
                      label="Correct answer"
                      value={
                        draft.correct == null ? "none" : String(draft.correct)
                      }
                      options={[
                        { value: "none", label: "No key" },
                        ...draft.options.map((_, i) => ({
                          value: String(i),
                          label: String.fromCharCode(65 + i),
                        })),
                      ]}
                      onChange={(value) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                correct:
                                  value === "none" ? null : Number(value),
                              }
                            : d,
                        )
                      }
                    />
                  }
                />
              ) : null}
              <Field
                label="Topic"
                value={String(draft.topic || "")}
                onChangeText={(topic) =>
                  setDraft((d) => (d ? { ...d, topic } : d))
                }
              />
              <Field
                label="Year"
                value={String(draft.year || "")}
                onChangeText={(year) =>
                  setDraft((d) => (d ? { ...d, year } : d))
                }
              />
              {isWrittenQuestion(draft) ? (
                <Field
                  label="Source answer"
                  multiline
                  value={draft.answerText || ""}
                  onChangeText={(answerText) =>
                    setDraft((d) =>
                      d ? { ...d, answerText, answerHtml: undefined } : d,
                    )
                  }
                />
              ) : null}
              <Field
                label="Explanation"
                multiline
                value={draft.explanation || ""}
                onChangeText={(explanation) =>
                  setDraft((d) =>
                    d ? { ...d, explanation, explanationHtml: undefined } : d,
                  )
                }
                style={{ minHeight: 80 }}
              />
            </View>
          </ScrollView>
          {questions.length > 1 ? (
            <Button
              kind="text"
              onPress={() => {
                setRemoved({ q: questions[editing], i: editing });
                setQuestions((old) => old.filter((_, i) => i !== editing));
                setDraft(null);
                setEditing(null);
              }}
            >
              Remove question
            </Button>
          ) : null}
          {editError ? <ErrorText>{editError}</ErrorText> : null}
          <Button onPress={saveEdit} style={{ marginTop: 20 }}>
            Save changes
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
