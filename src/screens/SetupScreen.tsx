import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import Check from "lucide-react-native/icons/check";
import Clock3 from "lucide-react-native/icons/clock-3";
import BookOpen from "lucide-react-native/icons/book-open";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import Pencil from "lucide-react-native/icons/pencil";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Title,
  Text,
  Muted,
  Button,
  IconButton,
  Checkbox,
  ErrorText,
  Dialog,
  SearchField,
  Loading,
  Row,
} from "../components/ui";
import Scholar from "../components/Scholar";
import Select from "../components/Select";
import * as records from "../storage/records";
import { getBundle } from "../services/library";
import { saveAttempt } from "../storage/practice";
import { createAttempt } from "../domain/attempt";
import {
  getAvailableSubjects,
  getAvailableTopics,
  getQuestionCountByTopic,
  isCbtQuestion,
} from "../domain/cbtFilters";
import {
  buildSubjectSession,
  defaultSubjectSettings,
  subjectYears,
  subjectPapers,
  subjectPool,
  subjectQuestionCount,
  type SubjectSettings,
} from "../domain/subjectSession";
import {
  durationFields,
  durationLabel,
  sessionDurationSeconds,
} from "../domain/sessionDuration";
import { questionUnits } from "../domain/theory";
import { fonts } from "../theme/tokens";
import type { Bundle, Question } from "../domain/types";
import type { Props } from "../navigation/types";
interface Draft {
  selected: string[];
  settings: Record<string, SubjectSettings>;
  mode: "practice" | "full";
  hours: string;
  minutes: string;
  shuffle: boolean;
  unseenFirst: boolean;
  mock: boolean;
}
export default function SetupScreen({ route, navigation }: Props<"Setup">) {
  const { owner, palette, refreshPractice } = useApp(),
    insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<Bundle | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [editing, setEditing] = useState<string | null>(null),
    [picker, setPicker] = useState(false),
    [topicPicker, setTopicPicker] = useState(false),
    [topicQuery, setTopicQuery] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    lock = useRef(false),
    scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const key = route.params.bundleId;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const b = await getBundle(owner, key);
        const subjects = getAvailableSubjects(b),
          saved = await records.read<Draft>(owner, "setup", key),
          settings: Record<string, SubjectSettings> = Object.create(null);
        for (const subject of subjects) {
          const pool = b.questions.filter(
              (q) => q.subject === subject && isCbtQuestion(q),
            ),
            defaults = defaultSubjectSettings(pool),
            old = saved?.settings?.[subject];
          settings[subject] =
            old &&
            ["paper", "topic"].includes(old.studyBy) &&
            (old.studyBy !== "paper" || subjectYears(pool).includes(old.year))
              ? { ...defaults, ...old }
              : defaults;
          const available = questionUnits(
            subjectPool(pool, settings[subject]),
          ).length;
          if (
            settings[subject].count !== "all" &&
            Number(settings[subject].count) > available &&
            available > 0
          )
            settings[subject].count = String(available);
        }
        if (active) {
          setBundle(b);
          setDraft({
            selected:
              saved?.selected?.filter((s) => subjects.includes(s)) ||
              (subjects.length <= 4 ? subjects : []),
            settings,
            mode: saved?.mode || "practice",
            ...durationFields("20"),
            hours: saved?.hours || "0",
            minutes: saved?.minutes || "20",
            shuffle: saved?.shuffle || false,
            unseenFirst: saved?.unseenFirst !== false,
            mock: saved?.mock || false,
          });
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not open this material.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [key, owner]);
  useEffect(() => {
    if (draft)
      void records
        .write(owner, "setup", key, draft)
        .catch(() => setError("Your setup could not be saved on this device."));
  }, [draft, owner, key]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step, editing]);
  const subjects = useMemo(
      () => (bundle ? getAvailableSubjects(bundle) : []),
      [bundle],
    ),
    bySubject = useMemo(() => {
      const map: Record<string, Question[]> = Object.create(null);
      for (const q of bundle?.questions || [])
        if (isCbtQuestion(q)) (map[q.subject] ||= []).push(q);
      return map;
    }, [bundle]);
  const counts = useMemo(
    () =>
      draft
        ? Object.fromEntries(
            draft.selected.map((s) => [
              s,
              subjectQuestionCount(bySubject[s] || [], draft.settings[s]),
            ]),
          )
        : {},
    [draft, bySubject],
  );
  const count = Object.values(counts).reduce((a, b) => a + b, 0),
    seconds = draft ? sessionDurationSeconds(draft.hours, draft.minutes) : null;
  const invalid = draft?.selected.find((s) => {
    const c = draft.settings[s].count;
    return (
      !counts[s] ||
      (c !== "all" &&
        (!/^\d+$/.test(c) ||
          Number(c) >
            questionUnits(subjectPool(bySubject[s] || [], draft.settings[s]))
              .length))
    );
  });
  const english = subjects.find((s) =>
    /^(use of )?english( language)?$/i.test(s),
  );
  const mockError = draft?.mock
    ? !english ||
      !draft.selected.includes(english) ||
      draft.selected.length !== 4
      ? "Choose English and three other subjects."
      : draft.selected.some((s) => counts[s] < (s === english ? 60 : 40))
        ? "Choose papers with 60 English questions and 40 for each other subject."
        : ""
    : "";
  function patch(value: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...value } : d));
  }
  function update(subject: string, value: Partial<SubjectSettings>) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.settings[subject], ...value };
      const available = questionUnits(
        subjectPool(bySubject[subject] || [], next),
      ).length;
      if (
        !("count" in value) &&
        next.count !== "all" &&
        Number(next.count) > available &&
        available > 0
      )
        next.count = String(available);
      return { ...d, settings: { ...d.settings, [subject]: next } };
    });
  }
  function toggle(subject: string) {
    if (!draft) return;
    if (
      draft.mock &&
      (subject === english ||
        (!draft.selected.includes(subject) && draft.selected.length >= 4))
    )
      return;
    patch({
      selected: draft.selected.includes(subject)
        ? draft.selected.filter((s) => s !== subject)
        : [...draft.selected, subject],
    });
  }
  function back() {
    if (editing) setEditing(null);
    else if (step) setStep(step - 1);
    else navigation.goBack();
  }
  function description(subject: string) {
    const s = draft!.settings[subject];
    return [
      s.studyBy === "paper" ? s.paper || s.year : "Topic practice",
      s.topics === null ? "All topics" : s.topics.length + " topics",
      counts[subject] + " questions",
    ].join(" · ");
  }
  async function begin() {
    if (
      lock.current ||
      !bundle ||
      !draft ||
      !seconds ||
      !draft.selected.length ||
      invalid ||
      mockError
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const evidence = await records.list<{ key: string }>(
        owner,
        "learning-evidence",
      );
      const questions = buildSubjectSession(
        draft.selected,
        bySubject,
        draft.settings,
        draft.shuffle,
        draft.mode === "practice" && draft.unseenFirst
          ? new Set(evidence.map((e) => e.key))
          : undefined,
      ) as Question[];
      const attempt = createAttempt(
        bundle,
        questions,
        seconds,
        draft.mode,
        owner,
        Crypto.randomUUID(),
      );
      await saveAttempt(attempt, true);
      await refreshPractice();
      navigation.replace("Exam", { attemptId: attempt.id });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start this session.",
      );
      lock.current = false;
    } finally {
      setBusy(false);
    }
  }
  if (!bundle || !draft)
    return (
      <Screen>
        <Header onBack={() => navigation.goBack()} title="Session setup" />
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <Loading label="Loading your material" />
        )}
      </Screen>
    );
  const current = editing ? draft.settings[editing] : null,
    pool = editing ? bySubject[editing] || [] : [],
    years = subjectYears(pool),
    papers = current ? subjectPapers(pool, current.year) : [],
    topics = current
      ? getAvailableTopics(subjectPool(pool, { ...current, topics: null }))
      : [];
  return (
    <Screen>
      <Header
        onBack={back}
        title={bundle.examType || bundle.title}
        style={{ minHeight: 68, paddingHorizontal: 20, paddingVertical: 12 }}
      />
      <View
        style={{
          flexDirection: "row",
          paddingVertical: 14,
          paddingHorizontal: 20,
          gap: 4,
        }}
      >
        {["Subjects", "Session", "Review"].map((name, index) => (
          <Pressable
            key={name}
            onPress={() => {
              if (index < step) setStep(index);
            }}
            style={{
              flex: 1,
              minHeight: 58,
              justifyContent: "center",
              paddingHorizontal: 6,
              borderBottomWidth: 2,
              borderBottomColor:
                (editing ? 0 : step) === index ? palette.accent : palette.line,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: fonts.semibold,
                color:
                  (editing ? 0 : step) === index ? palette.ink : palette.muted,
              }}
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: 36,
          width: "100%",
          maxWidth: 740,
          alignSelf: "center",
        }}
      >
        {!editing &&
        step === 0 &&
        (bundle.kind === "utme-bank" ||
          /^UTME$/i.test(bundle.examType || "")) ? (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            <Button
              kind={draft.mock ? "secondary" : "primary"}
              onPress={() => patch({ mock: false })}
              style={{ flex: 1 }}
            >
              Custom
            </Button>
            <Button
              kind={draft.mock ? "primary" : "secondary"}
              disabled={!english}
              onPress={() => {
                patch({
                  mock: true,
                  mode: "full",
                  hours: "2",
                  minutes: "0",
                  shuffle: false,
                  selected: [
                    english!,
                    ...draft.selected.filter((s) => s !== english).slice(0, 3),
                  ],
                  settings: Object.fromEntries(
                    Object.entries(draft.settings).map(([s, value]) => [
                      s,
                      { ...value, count: s === english ? "60" : "40" },
                    ]),
                  ),
                });
              }}
              style={{ flex: 1 }}
            >
              UTME mock
            </Button>
          </View>
        ) : null}
        {draft.mock ? (
          <Muted>
            English 60 + three subjects of 40 · 120 minutes · 2026 format
          </Muted>
        ) : null}
        {mockError ? <ErrorText>{mockError}</ErrorText> : null}
        {editing && current ? (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <Title size={27} style={{ flex: 1 }}>
                {editing}
              </Title>
              <Muted>{counts[editing]} questions</Muted>
            </View>
            {years.length ? (
              <Row
                title="Study by"
                right={
                  <Select
                    label="Study by"
                    value={current.studyBy}
                    options={[
                      { value: "paper", label: "Past paper" },
                      { value: "topic", label: "Topic practice" },
                    ]}
                    onChange={(value) =>
                      update(editing, {
                        studyBy: value as "paper" | "topic",
                        topics: null,
                      })
                    }
                  />
                }
              />
            ) : null}
            {current.studyBy === "paper" && years.length ? (
              <>
                <Row
                  title="Year"
                  right={
                    <Select
                      label="Year"
                      value={current.year}
                      options={years.map((v) => ({ value: v, label: v }))}
                      onChange={(value) =>
                        update(editing, {
                          year: value,
                          paper: subjectPapers(pool, value)[0] || "",
                          topics: null,
                        })
                      }
                    />
                  }
                />
                {papers.length > 1 ? (
                  <Row
                    title="Paper"
                    right={
                      <Select
                        label="Paper"
                        value={current.paper}
                        options={papers.map((v) => ({ value: v, label: v }))}
                        onChange={(value) =>
                          update(editing, { paper: value, topics: null })
                        }
                      />
                    }
                  />
                ) : null}
              </>
            ) : null}
            {topics.length ? (
              <Row
                title={
                  current.studyBy === "topic" ? "Topics / sections" : "Topics"
                }
                onPress={() => {
                  setTopicQuery("");
                  setTopicPicker(true);
                }}
                right={
                  <Muted>
                    {current.topics === null
                      ? "All"
                      : current.topics.length + " selected"}
                  </Muted>
                }
              />
            ) : null}
            {!topics.length ? (
              <Muted style={{ marginVertical: 16 }}>
                No topic labels available.
              </Muted>
            ) : null}
            <Row
              title="Questions"
              right={
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <TextInput
                    accessibilityLabel={"Questions for " + editing}
                    value={
                      current.count === "all"
                        ? String(
                            questionUnits(subjectPool(pool, current)).length,
                          )
                        : current.count
                    }
                    onChangeText={(value) => {
                      patch({ mock: false });
                      update(editing, { count: value });
                    }}
                    keyboardType="number-pad"
                    style={{
                      width: 68,
                      minHeight: 48,
                      borderWidth: 1,
                      borderColor: palette.line,
                      borderRadius: 8,
                      color: palette.ink,
                      backgroundColor: palette.control,
                      fontFamily: fonts.display,
                      fontSize: 18,
                      padding: 12,
                    }}
                  />
                  <Button
                    kind="text"
                    onPress={() => {
                      patch({ mock: false });
                      update(editing, { count: "all" });
                    }}
                  >
                    All available
                  </Button>
                </View>
              }
            />
            <Muted style={{ marginTop: 24 }}>
              {questionUnits(subjectPool(pool, current)).length} available in
              this selection
            </Muted>
            {invalid === editing ? (
              <ErrorText>
                Enter a question count within the available selection.
              </ErrorText>
            ) : null}
          </>
        ) : step === 0 ? (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Title size={27}>Subjects</Title>
              <Button
                kind="text"
                onPress={() => {
                  setSearch("");
                  setPicker(true);
                }}
              >
                <Plus size={17} color={palette.accent} />
                <Text style={{ fontSize: 12, color: palette.accent }}>
                  {draft.selected.length ? "Change" : "Choose subjects"}
                </Text>
              </Button>
            </View>
            {draft.selected.length ? (
              draft.selected.map((subject, index) => (
                <View
                  key={subject}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.line,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: palette.faint,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <Pressable
                    onPress={() => setEditing(subject)}
                    style={{ flex: 1, paddingVertical: 8 }}
                  >
                    <Text style={{ fontFamily: fonts.semibold }}>
                      {subject}
                    </Text>
                    <Muted style={{ fontSize: 10, marginTop: 5 }}>
                      {description(subject)}
                    </Muted>
                  </Pressable>
                  <IconButton
                    label={"Remove " + subject}
                    disabled={draft.mock && subject === english}
                    onPress={() => toggle(subject)}
                    style={{ width: 30 }}
                  >
                    <X size={16} color={palette.muted} />
                  </IconButton>
                </View>
              ))
            ) : (
              <View
                style={{
                  minHeight: 280,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                }}
              >
                <Scholar state="thinking" width={120} />
                <Button onPress={() => setPicker(true)}>Choose subjects</Button>
              </View>
            )}
          </>
        ) : step === 1 ? (
          <>
            <Title size={27} style={{ marginBottom: 24 }}>
              Session
            </Title>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["practice", "full"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() =>
                    patch({
                      mode,
                      ...(mode === "practice" ? { mock: false } : {}),
                    })
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 15,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor:
                      draft.mode === mode ? palette.accent : palette.line,
                    borderRadius: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 9,
                    backgroundColor:
                      draft.mode === mode ? palette.accentWash : "transparent",
                  }}
                >
                  {mode === "practice" ? (
                    <BookOpen size={18} color={palette.muted} />
                  ) : (
                    <Clock3 size={18} color={palette.muted} />
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.semibold,
                      flex: 1,
                    }}
                  >
                    {mode === "practice" ? "Practice" : "Exam"}
                  </Text>
                  {draft.mode === mode ? (
                    <Check size={14} color={palette.accent} />
                  ) : null}
                </Pressable>
              ))}
            </View>
            <View
              style={{
                paddingVertical: 24,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
                gap: 16,
              }}
            >
              <Text>Time limit</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                {(["hours", "minutes"] as const).map((field, index) => (
                  <React.Fragment key={field}>
                    {index ? <Muted style={{ paddingTop: 22 }}>:</Muted> : null}
                    <View style={{ flex: 1, gap: 8 }}>
                      <Muted>{field === "hours" ? "Hours" : "Minutes"}</Muted>
                      <TextInput
                        accessibilityLabel={"Time limit " + field}
                        value={draft[field]}
                        onChangeText={(value) =>
                          patch({ [field]: value, mock: false })
                        }
                        keyboardType="number-pad"
                        style={{
                          minHeight: 48,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: palette.line,
                          borderRadius: 8,
                          backgroundColor: palette.control,
                          color: palette.ink,
                          fontFamily: fonts.display,
                          fontSize: 20,
                        }}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
            {seconds === null ? (
              <ErrorText>
                Enter a time greater than zero. Minutes must be between 0 and
                59.
              </ErrorText>
            ) : null}
            {draft.mode === "practice" ? (
              <Row
                title="Start with unseen questions"
                right={
                  <Checkbox
                    checked={draft.unseenFirst}
                    label="Start with unseen questions"
                    onPress={() => patch({ unseenFirst: !draft.unseenFirst })}
                  />
                }
              />
            ) : null}
            <Row
              title="Shuffle questions"
              right={
                <Checkbox
                  checked={draft.shuffle}
                  label="Shuffle questions"
                  onPress={() => patch({ shuffle: !draft.shuffle })}
                />
              }
            />
          </>
        ) : (
          <>
            <Title size={27} style={{ marginBottom: 24 }}>
              Review
            </Title>
            <View
              style={{
                paddingTop: 8,
                paddingBottom: 30,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
              }}
            >
              <Title size={56}>{count.toLocaleString()}</Title>
              <Muted style={{ marginTop: 12 }}>
                questions · {durationLabel(seconds)} ·{" "}
                {draft.mode === "full" ? "Exam" : "Practice"}
              </Muted>
            </View>
            {draft.selected.map((subject) => (
              <Row
                key={subject}
                title={subject}
                detail={description(subject)}
                onPress={() => setEditing(subject)}
                right={<Pencil size={17} color={palette.muted} />}
                style={{ minHeight: 94, paddingVertical: 20 }}
              />
            ))}
            <Button kind="text" onPress={() => setStep(1)}>
              Change session settings
            </Button>
          </>
        )}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </ScrollView>
      <View
        style={{
          paddingTop: 16,
          paddingBottom: Math.max(16, insets.bottom),
          paddingHorizontal: 22,
          borderTopWidth: 1,
          borderTopColor: palette.line,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <View>
          <Text style={{ fontSize: 13, fontFamily: fonts.semibold }}>
            {count.toLocaleString()} questions
          </Text>
          <Muted style={{ fontSize: 11 }}>
            {draft.selected.length}{" "}
            {draft.selected.length === 1 ? "subject" : "subjects"}
          </Muted>
        </View>
        <Button
          arrow={!editing}
          busy={busy}
          disabled={
            busy ||
            (!!editing && invalid === editing) ||
            (!editing &&
              (!draft.selected.length ||
                (step === 1 && seconds === null) ||
                (step === 2 && (!!invalid || seconds === null || !!mockError))))
          }
          onPress={() =>
            editing
              ? setEditing(null)
              : step === 2
                ? void begin()
                : setStep(step + 1)
          }
          style={{ minWidth: 140 }}
        >
          {editing ? "Done" : step === 2 ? "Start session" : "Continue"}
        </Button>
      </View>
      {picker ? (
        <Dialog title="Choose subjects" onClose={() => setPicker(false)}>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Find a subject"
          />
          <FlatList
            data={subjects.filter((s) =>
              s.toLowerCase().includes(search.toLowerCase()),
            )}
            keyExtractor={(s) => s}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 400 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => toggle(item)}
                style={{
                  minHeight: 52,
                  flexDirection: "row",
                  gap: 14,
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: palette.line,
                }}
              >
                <Checkbox
                  checked={draft.selected.includes(item)}
                  label={item}
                  onPress={() => toggle(item)}
                />
                <Text style={{ flex: 1, fontSize: 13 }}>{item}</Text>
                <Muted style={{ fontFamily: fonts.mono, fontSize: 10 }}>
                  {bySubject[item]?.length || 0}
                </Muted>
              </Pressable>
            )}
          />
          <Button onPress={() => setPicker(false)} style={{ marginTop: 20 }}>
            Done{draft.selected.length ? " · " + draft.selected.length : ""}
          </Button>
        </Dialog>
      ) : null}
      {topicPicker && editing && current ? (
        <Dialog
          title={editing + " topics"}
          onClose={() => setTopicPicker(false)}
        >
          <Row
            title="All topics"
            right={
              <Checkbox
                checked={current.topics === null}
                label="All topics"
                onPress={() =>
                  update(editing, {
                    topics: current.topics === null ? [] : null,
                  })
                }
              />
            }
          />
          <SearchField
            value={topicQuery}
            onChangeText={setTopicQuery}
            placeholder="Find a topic or section"
          />
          <FlatList
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Muted style={{ paddingVertical: 20 }}>No matching topics.</Muted>
            }
            data={topics.filter((t) =>
              t.toLowerCase().includes(topicQuery.trim().toLowerCase()),
            )}
            keyExtractor={(s) => s}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const chosen =
                current.topics === null || current.topics.includes(item);
              return (
                <Row
                  title={item}
                  detail={
                    (getQuestionCountByTopic(
                      subjectPool(pool, { ...current, topics: null }),
                    )[item] || 0) + " questions available"
                  }
                  onPress={() => {
                    const values =
                      current.topics === null ? [...topics] : current.topics;
                    update(editing, {
                      topics: chosen
                        ? values.filter((t) => t !== item)
                        : [...values, item],
                    });
                  }}
                  right={
                    <Checkbox
                      checked={chosen}
                      label={item}
                      onPress={() => {
                        const values =
                          current.topics === null
                            ? [...topics]
                            : current.topics;
                        update(editing, {
                          topics: chosen
                            ? values.filter((t) => t !== item)
                            : [...values, item],
                        });
                      }}
                    />
                  }
                />
              );
            }}
          />
          <Button
            onPress={() => setTopicPicker(false)}
            style={{ marginTop: 20 }}
          >
            Done
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
