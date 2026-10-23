import React, { useState } from "react";
import { View, SectionList } from "react-native";
import BookOpen from "lucide-react-native/icons/book-open";
import Trash2 from "lucide-react-native/icons/trash";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Title,
  Text,
  Muted,
  Button,
  Row,
  IconButton,
  Dialog,
  Empty,
  ErrorText,
} from "../components/ui";
import {
  discardAttempt,
  deleteAttempt,
  type AttemptHeader,
} from "../storage/practice";
import { mergeHistory, historyDays, type HistoryItem } from "../domain/history";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function HistoryScreen({ navigation }: Props<"History">) {
  const {
      owner,
      palette,
      attempts,
      refreshPractice,
      remoteSessions,
      syncNow,
      syncError,
      deletedSessions,
    } = useApp(),
    [discard, setDiscard] = useState<AttemptHeader | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cloud, setCloud] = useState<HistoryItem | null>(null),
    [remove, setRemove] = useState<HistoryItem | null>(null),
    [refreshing, setRefreshing] = useState(false);
  const active = attempts.filter((a) => a.status === "active"),
    completed = mergeHistory(attempts, remoteSessions, deletedSessions);
  return (
    <Screen>
      <Header title="Past sessions" onBack={() => navigation.goBack()} />
      <SectionList
        sections={historyDays(completed)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Muted
            style={{
              fontSize: 13,
              fontFamily: fonts.semibold,
              paddingTop: 18,
              paddingBottom: 6,
            }}
          >
            {section.title} · {section.data.length} session
            {section.data.length === 1 ? "" : "s"}
          </Muted>
        )}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void Promise.all([refreshPractice(), syncNow()]).finally(() =>
            setRefreshing(false),
          );
        }}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: 24,
          width: "100%",
          maxWidth: 800,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View>
            {syncError ? (
              <>
                <Muted style={{ fontSize: 12 }}>{syncError}</Muted>
                <Button kind="text" onPress={() => void syncNow()}>
                  Retry sync
                </Button>
              </>
            ) : null}
            {
              <>
                {active.length ? (
                  <View style={{ marginBottom: 24 }}>
                    <Muted
                      style={{
                        fontSize: 14,
                        fontFamily: fonts.semibold,
                        marginBottom: 4,
                      }}
                    >
                      Unfinished
                    </Muted>
                    {active.map((a) => (
                      <Row
                        key={a.id}
                        title={a.title}
                        detail={
                          a.summary.answered +
                          " of " +
                          a.questionCount +
                          " answered"
                        }
                        icon={<BookOpen size={22} color={palette.muted} />}
                        right={
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Button
                              onPress={() =>
                                navigation.navigate("Exam", { attemptId: a.id })
                              }
                            >
                              Resume
                            </Button>
                            <IconButton
                              label={"Discard " + a.title}
                              onPress={() => {
                                setDiscard(a);
                                setError("");
                              }}
                            >
                              <Trash2 size={17} color={palette.muted} />
                            </IconButton>
                          </View>
                        }
                      />
                    ))}
                  </View>
                ) : null}
                {active.length && completed.length ? (
                  <Muted style={{ fontSize: 14, fontFamily: fonts.semibold }}>
                    Completed
                  </Muted>
                ) : null}
              </>
            }
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
            }}
          >
            <View style={{ flex: 1 }}>
              <Row
                title={item.title}
                detail={
                  new Date(item.completedAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  }) +
                  (item.local
                    ? " · Review answers"
                    : " · Synced from your account")
                }
                icon={<BookOpen size={22} color={palette.muted} />}
                onPress={() =>
                  item.local
                    ? navigation.navigate("Results", { attemptId: item.id })
                    : setCloud(item)
                }
                style={{ borderBottomWidth: 0 }}
                right={
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.semibold }}>
                      {item.percent === null ? "Completed" : item.percent + "%"}
                    </Text>
                    <ArrowRight size={15} color={palette.muted} />
                  </View>
                }
              />
            </View>
            <IconButton
              label={"Delete session " + item.title}
              onPress={() => {
                setRemove(item);
                setError("");
              }}
            >
              <Trash2 size={17} color={palette.muted} />
            </IconButton>
          </View>
        )}
        ListEmptyComponent={
          <View>
            {active.length ? null : (
              <Empty
                title="No sessions yet."
                icon={
                  <BookOpen size={30} strokeWidth={1.3} color={palette.muted} />
                }
              >
                <Button
                  arrow
                  onPress={() =>
                    navigation.navigate("Main", { tab: "library" })
                  }
                >
                  Find a paper
                </Button>
              </Empty>
            )}
          </View>
        }
      />
      {cloud ? (
        <Dialog title={cloud.title} onClose={() => setCloud(null)}>
          <Title size={40}>
            {cloud.percent === null ? "Completed" : cloud.percent + "%"}
          </Title>
          <Muted style={{ marginTop: 16 }}>
            {cloud.correct} correct · {cloud.total} questions
          </Muted>
          <Muted style={{ marginTop: 12 }}>
            This result is synced from your account. Detailed answers are stored
            on the device where you took the session.
          </Muted>
          <Button style={{ marginTop: 20 }} onPress={() => setCloud(null)}>
            Done
          </Button>
        </Dialog>
      ) : null}
      {remove ? (
        <Dialog
          title="Delete this saved session?"
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <Muted>
            Saved answers and working for this session will be removed from this
            device. Downloaded papers and account summaries on other devices
            stay saved.
          </Muted>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            kind="secondary"
            disabled={busy}
            onPress={() => setRemove(null)}
            style={{ marginTop: 22 }}
          >
            Keep session
          </Button>
          <Button
            busy={busy}
            onPress={() => {
              setBusy(true);
              void deleteAttempt(owner, remove.id)
                .then(refreshPractice)
                .then(() => setRemove(null))
                .catch(() =>
                  setError("Could not delete this session. Try again."),
                )
                .finally(() => setBusy(false));
            }}
            style={{ marginTop: 12 }}
          >
            Delete from this device
          </Button>
        </Dialog>
      ) : null}
      {discard ? (
        <Dialog
          title="Discard this unfinished exam?"
          onClose={() => {
            if (!busy) setDiscard(null);
          }}
        >
          <Muted>
            Your completed sessions and downloaded papers stay saved.
          </Muted>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            kind="secondary"
            disabled={busy}
            onPress={() => setDiscard(null)}
            style={{ marginTop: 22 }}
          >
            Keep exam
          </Button>
          <Button
            busy={busy}
            onPress={() => {
              setBusy(true);
              void discardAttempt(owner, discard.id)
                .then(refreshPractice)
                .then(() => setDiscard(null))
                .catch(() =>
                  setError("Could not discard this exam. Try again."),
                )
                .finally(() => setBusy(false));
            }}
            style={{ marginTop: 12 }}
          >
            Discard exam
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
