import RichText from "../components/RichText";
import { isWrittenQuestion, theoryLabel } from "../domain/theory";
import { confirmedMaterial } from "../services/confirmedMaterial";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, ScrollView, Pressable } from "react-native";
import Edit2 from "lucide-react-native/icons/pen";
import Plus from "lucide-react-native/icons/plus";
import Trash2 from "lucide-react-native/icons/trash";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Text,
  Title,
  Muted,
  Button,
  IconButton,
  Field,
  ErrorText,
  Dialog,
  Loading,
  Row,
} from "../components/ui";
import Scholar from "../components/Scholar";
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
    [error, setError] = useState("");
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
          if (!value.questions?.length) {
            navigation.replace("Processing", {
              sessionId: route.params.sessionId,
            });
            return;
          }
          await records.write(owner, "vision-session", value.id, value);
          if (!active) return;
          setSession(value);
          setQuestions(value.questions || []);
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
  const minimumOptions = (q: Question) =>
      q.type &&
      !["single_choice", "multiple_choice", "true_false"].includes(q.type)
        ? 0
        : 2,
    blocking = questions.filter(
      (q) =>
        !q.question.trim() ||
        q.options.filter((o) => o.trim()).length < minimumOptions(q) ||
        q.incomplete,
    ),
    flagged = questions.filter((q) => q.needsReview);
  async function save() {
    if (saveLock.current || blocking.length || !questions.length) return;
    saveLock.current = true;
    setBusy(true);
    setError("");
    try {
      const bundle = await confirmMaterial(route.params.sessionId, questions);
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
    const kept = draft.options
        .map((text, index) => ({ text: text.trim(), index }))
        .filter((o) => o.text),
      correct =
        draft.correct == null
          ? null
          : kept.findIndex((o) => o.index === draft.correct),
      options = kept.map((o) => o.text),
      incomplete =
        !draft.question.trim() || options.length < minimumOptions(draft),
      reasons = Array.isArray(draft.reviewReasons)
        ? draft.reviewReasons.filter(
            (r) => r !== "insufficient_complete_options",
          )
        : [];
    if (incomplete) reasons.push("insufficient_complete_options");
    const next = {
      ...draft,
      question: draft.question.trim(),
      options,
      correct: correct !== null && correct >= 0 ? correct : null,
      incomplete,
      reviewReasons: reasons,
      needsReview: incomplete || reasons.length > 0,
    };
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
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
          backgroundColor: palette.panel,
        }}
      >
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 16 }}>
          Review questions
        </Text>
      </View>
      {groups.length > 1 ? (
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
        data={visible}
        keyExtractor={({ q, i }) => String(q.id) + "-" + i}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 12,
        }}
        ListHeaderComponent={
          <View>
            {blocking.length || flagged.length ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: palette.accentWash,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: palette.accent,
                    fontFamily: fonts.serifMedium,
                    fontSize: 12,
                  }}
                >
                  Check marked questions
                </Text>
                <Text
                  style={{
                    color: palette.accent,
                    fontFamily: fonts.outfit,
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  {blocking.length} incomplete · {flagged.length} to check
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: { q, i }, index }) => (
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
                {q.needsReview ? (
                  <Text
                    style={{
                      fontSize: 10,
                      color: palette.accent,
                      backgroundColor: palette.accentWash,
                      borderRadius: 12,
                      paddingHorizontal: 8,
                    }}
                  >
                    Review
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
              " incomplete question" +
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
                              correct: value === "none" ? null : Number(value),
                            }
                          : d,
                      )
                    }
                  />
                }
              />
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
          <Button onPress={saveEdit} style={{ marginTop: 20 }}>
            Save changes
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
