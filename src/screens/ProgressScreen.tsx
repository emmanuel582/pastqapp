import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, FlatList } from "react-native";
import * as Crypto from "expo-crypto";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Text,
  Title,
  Muted,
  Button,
  Loading,
  ErrorText,
} from "../components/ui";
import Select from "../components/Select";
import ProgressChart from "../components/ProgressChart";
import { readAttempt, saveAttempt } from "../storage/practice";
import { createAttempt } from "../domain/attempt";
import {
  progressSession,
  topicProgress,
  topicAdvice,
  topicPracticePaper,
  type ProgressSession,
  type TopicProgress,
} from "../domain/topicProgress";
import type { Attempt } from "../domain/types";
import type { Props } from "../navigation/types";
import { fonts } from "../theme/tokens";
export default function ProgressScreen({ navigation }: Props<"Progress">) {
  const { owner, palette, attempts, refreshPractice } = useApp();
  const [sessions, setSessions] = useState<ProgressSession[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [subject, setSubject] = useState(""),
    [period, setPeriod] = useState("all"),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const ownerRef = useRef(owner),
    lock = useRef(false);
  ownerRef.current = owner;
  const completedKey = attempts
    .filter((a) => a.status === "completed")
    .map((a) => JSON.stringify([a.id, a.completedAt, a.summary]))
    .join(";");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSessions([]);
    void (async () => {
      const values: ProgressSession[] = [];
      let failed = 0;
      for (const header of attempts.filter((a) => a.status === "completed")) {
        if (!active) return;
        try {
          const row =
            header.topicProgress ||
            progressSession(await readAttempt(owner, header.id));
          if (row) values.push(row);
        } catch {
          failed++;
        }
      }
      if (active) {
        setSessions(values);
        setLoading(false);
        if (failed)
          setError(
            "Some saved papers could not open. They are not included in these scores.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [owner, completedKey]);
  const all = useMemo(() => topicProgress(sessions), [sessions]);
  const subjects = useMemo(
    () => [...new Set(all.map((v) => v.subject))].sort(),
    [all],
  );
  const rows = useMemo(
    () =>
      topicProgress(
        sessions,
        period === "all" ? 0 : Date.now() - Number(period) * 86400000,
      ).filter((v) => !subject || v.subject === subject),
    [sessions, period, subject],
  );
  const detail = rows.find((r) => r.id === selected),
    graded = rows.reduce((n, r) => n + r.graded, 0),
    correct = rows.reduce((n, r) => n + r.correct, 0),
    weak = rows.filter((r) => r.graded >= 5 && r.percent! < 50);
  const card = {
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: palette.panel,
  };
  async function practice(row: TopicProgress) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const papers: Attempt[] = [];
      for (const id of [...row.sourceIds].reverse()) {
        if (ownerRef.current !== owner) return;
        const a = await readAttempt(owner, id);
        if (a.owner === owner) papers.push(a);
        const candidate = topicPracticePaper(papers, row.id);
        if (candidate && candidate.questions.length >= 10) break;
      }
      const paper = topicPracticePaper(papers, row.id);
      if (!paper)
        throw Error(
          "No auto-marked questions are available for this topic yet.",
        );
      if (ownerRef.current !== owner) return;
      const a = createAttempt(
        paper,
        paper.questions,
        1200,
        "practice",
        owner,
        Crypto.randomUUID(),
      );
      await saveAttempt(a, true);
      if (ownerRef.current !== owner) return;
      await refreshPractice();
      navigation.navigate("Exam", { attemptId: a.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this topic.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const filters = (
    <View style={{ gap: 12, marginBottom: 20 }}>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Select
          label="Subject"
          value={subject}
          options={[
            { value: "", label: "All subjects" },
            ...subjects.map((s) => ({ value: s, label: s })),
          ]}
          onChange={(v) => {
            setSubject(v);
            setSelected(null);
          }}
        />
        <Select
          label="When"
          value={period}
          options={[
            { value: "all", label: "All time" },
            { value: "30", label: "Last 30 days" },
            { value: "7", label: "Last 7 days" },
          ]}
          onChange={(v) => {
            setPeriod(v);
            setSelected(null);
          }}
        />
      </View>
    </View>
  );
  const overview = (
    <View style={{ gap: 16, marginBottom: 20 }}>
      {filters}
      <View style={card}>
        <Muted>{subject || "All subjects"}</Muted>
        <Title size={36} style={{ marginTop: 8 }}>
          {graded ? Math.round((correct * 100) / graded) + "%" : "—"}
        </Title>
        <Text style={{ marginTop: 6 }}>
          {correct} of {graded} marked questions correct
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 18 }}>
        Topics to work on
      </Text>
    </View>
  );
  function topicCard(row: TopicProgress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          row.subject +
          ", " +
          row.topic +
          ", " +
          topicAdvice(row) +
          (row.percent === null ? "" : ", " + row.percent + " percent") +
          ". Open topic progress"
        }
        onPress={() => setSelected(row.id)}
        style={[card, { marginBottom: 12, gap: 8 }]}
      >
        <Muted>{row.subject}</Muted>
        <Text style={{ fontSize: 18, fontFamily: fonts.semibold }}>
          {row.topic}
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text>{topicAdvice(row)}</Text>
          <Text style={{ fontFamily: fonts.bold }}>
            {row.percent === null ? "—" : row.percent + "%"}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={
            row.correct + " correct out of " + row.graded + " marked questions"
          }
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: palette.line,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 8,
              width: ((row.percent || 0) + "%") as `${number}%`,
              backgroundColor: palette.accent,
              borderRadius: 4,
            }}
          />
        </View>
        <Muted>
          {row.correct} correct · {row.wrong} wrong · {row.skipped} skipped
          {row.ungraded ? " · " + row.ungraded + " unmarked" : ""}
        </Muted>
      </Pressable>
    );
  }
  return (
    <Screen>
      <Header
        title={detail ? "Topic progress" : "Your progress"}
        onBack={() => (selected ? setSelected(null) : navigation.goBack())}
      />
      {loading ? (
        <Loading label="Opening your practice results…" />
      ) : (
        <FlatList
          key={detail ? "detail" : "topics"}
          data={detail ? [] : rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => topicCard(item)}
          contentContainerStyle={{
            padding: 22,
            paddingBottom: 40,
            width: "100%",
            maxWidth: 744,
            alignSelf: "center",
          }}
          initialNumToRender={8}
          windowSize={5}
          ListHeaderComponent={
            detail ? (
              <View style={{ gap: 18 }}>
                {error ? <ErrorText>{error}</ErrorText> : null}
                <Muted>{detail.subject}</Muted>
                <Title size={30}>{detail.topic}</Title>
                <View style={card}>
                  <Text style={{ fontFamily: fonts.semibold }}>
                    {topicAdvice(detail)}
                  </Text>
                  <Title size={38} style={{ marginVertical: 10 }}>
                    {detail.percent === null ? "—" : detail.percent + "%"}
                  </Title>
                  <Text>
                    {detail.correct} of {detail.graded} marked questions correct
                  </Text>
                  <Muted style={{ marginTop: 8 }}>
                    {detail.wrong} wrong · {detail.skipped} skipped ·{" "}
                    {detail.ungraded} unmarked
                  </Muted>
                  {detail.graded > 0 && detail.graded < 5 ? (
                    <Muted style={{ marginTop: 8 }}>
                      {detail.graded} marked so far · keep practising
                    </Muted>
                  ) : null}
                </View>
                {detail.graded ? (
                  <Button
                    arrow
                    busy={busy}
                    onPress={() => void practice(detail)}
                  >
                    Practise this topic only
                  </Button>
                ) : null}
                {detail.points.length ? (
                  <View style={card}>
                    <Text
                      style={{
                        fontSize: 17,
                        fontFamily: fonts.semibold,
                        marginBottom: 12,
                      }}
                    >
                      Are you improving?
                    </Text>
                    <ProgressChart
                      items={detail.points.map((p) => ({
                        id: p.id,
                        title: detail.topic,
                        percent: p.percent,
                        completedAt: p.at,
                        correct: p.correct,
                        total: p.graded,
                      }))}
                    />
                  </View>
                ) : (
                  <Muted>Unmarked · review in Past sessions.</Muted>
                )}
                {detail.points
                  .slice(-5)
                  .reverse()
                  .map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      onPress={() =>
                        navigation.navigate("Exam", {
                          attemptId: p.id,
                          review: true,
                        })
                      }
                      style={{
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: palette.line,
                        gap: 5,
                      }}
                    >
                      <Text>
                        {new Date(p.at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {p.percent}%
                      </Text>
                      <Muted>
                        {p.correct} correct · {p.wrong} wrong · {p.skipped}{" "}
                        skipped
                      </Muted>
                      <Text style={{ color: palette.accent, fontSize: 12 }}>
                        Review this practice →
                      </Text>
                    </Pressable>
                  ))}
              </View>
            ) : (
              <>
                {error ? <ErrorText>{error}</ErrorText> : null}
                {overview}
              </>
            )
          }
          ListEmptyComponent={
            detail ? null : (
              <View style={{ gap: 16 }}>
                <Muted>
                  {all.length
                    ? "No finished practice matches these filters."
                    : "Finish a practice to see your topics."}
                </Muted>
                <Button
                  onPress={() =>
                    navigation.navigate("Main", { tab: "library" })
                  }
                >
                  Find questions to practise
                </Button>
              </View>
            )
          }
          ListFooterComponent={
            <Muted style={{ marginTop: 22 }}>
              Based on finished practices saved on this phone.
            </Muted>
          }
        />
      )}
    </Screen>
  );
}
