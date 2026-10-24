import React, { useEffect, useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import Compass from "lucide-react-native/icons/compass";
import KeyRound from "lucide-react-native/icons/key-round";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { Image } from "expo-image";
import { useApp } from "../state/AppContext";
import {
  Header,
  Text,
  Title,
  Muted,
  SearchField,
  Tabs,
  Button,
  Field,
  Empty,
  ErrorText,
  Dialog,
} from "../components/ui";
import Skeleton from "../components/Skeleton";
import { request, json } from "../services/api";
import type { StudySession } from "../domain/types";
import type { Navigation } from "../navigation/types";
import { fonts } from "../theme/tokens";
export default function DiscoverScreen({
  navigation,
}: {
  navigation: Navigation;
}) {
  const { palette, owner } = useApp();
  const [data, setData] = useState<{
      sessions: StudySession[];
      joined: StudySession[];
    }>({ sessions: [], joined: [] }),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState<"all" | "tutorial" | "exam" | "joined">(
      "all",
    ),
    [showCode, setShowCode] = useState(false),
    [code, setCode] = useState(""),
    [selected, setSelected] = useState<StudySession | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [joinError, setJoinError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const value = await request<typeof data>(
        "/api/discover",
        { signal },
        true,
      );
      if (!signal?.aborted) setData(value);
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : "Could not load sessions.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [owner]);
  const rows = (filter === "joined" ? data.joined : data.sessions).filter(
    (s) =>
      (filter === "all" || filter === "joined" || s.kind === filter) &&
      [s.title, s.tag].some((v) =>
        v?.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  async function join() {
    if (busy) return;
    setBusy(true);
    setJoinError("");
    try {
      const result = await request<{ session: StudySession }>(
        code.trim()
          ? "/api/discover/join"
          : "/api/discover/" + encodeURIComponent(selected!.id) + "/join",
        json("POST", code.trim() ? { code: code.trim() } : {}),
        true,
      );
      setData((previous) => ({
        sessions: previous.sessions.map((s) =>
          s.id === result.session.id ? result.session : s,
        ),
        joined: [
          result.session,
          ...previous.joined.filter((s) => s.id !== result.session.id),
        ],
      }));
      setShowCode(false);
      setCode("");
      setSelected(result.session);
    } catch (e) {
      setJoinError(
        e instanceof Error ? e.message : "Could not join. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Discover"
        style={{ minHeight: 60, paddingVertical: 10 }}
        right={
          <Button
            kind="text"
            onPress={() => {
              setShowCode((v) => !v);
              setJoinError("");
            }}
          >
            <KeyRound size={17} color={palette.accent} />
            <Text
              style={{
                fontSize: 12,
                color: palette.accent,
                fontFamily: fonts.semibold,
              }}
            >
              Join with code
            </Text>
          </Button>
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 22,
          paddingTop: 16,
          width: "100%",
          maxWidth: 1144,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View>
            {
              <>
                <SearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Find a tutorial or exam session"
                />
                {showCode ? (
                  <View
                    style={{
                      padding: 16,
                      marginTop: 24,
                      borderWidth: 1,
                      borderColor: palette.line,
                      borderRadius: 12,
                      backgroundColor: palette.panel,
                      gap: 12,
                    }}
                  >
                    <Field
                      label="Private session code"
                      placeholder="Code from your tutor"
                      value={code}
                      onChangeText={(v) => setCode(v.toUpperCase())}
                      maxLength={24}
                      autoCapitalize="characters"
                    />
                    <Button
                      arrow
                      disabled={!code.trim() || busy}
                      busy={busy}
                      onPress={() => void join()}
                    >
                      Join
                    </Button>
                    {joinError ? <ErrorText>{joinError}</ErrorText> : null}
                  </View>
                ) : null}
                <Tabs
                  options={[
                    { id: "all", label: "All" },
                    { id: "tutorial", label: "Tutorials" },
                    { id: "exam", label: "Exams" },
                    { id: "joined", label: "Joined" },
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
                {error ? (
                  <>
                    <ErrorText>{error}</ErrorText>
                    <Button kind="text" onPress={() => void load()}>
                      Try again
                    </Button>
                  </>
                ) : null}
                {loading ? <Skeleton kind="sessions" /> : null}
              </>
            }
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setSelected(item);
              setJoinError("");
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 20,
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: palette.line,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {item.logo ? (
                <Image source={item.logo} style={{ width: 48, height: 48 }} />
              ) : (
                <Compass size={22} color={palette.accent} />
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold }}>{item.title}</Text>
              <Muted>
                {item.kind === "exam" ? "Exam" : "Tutorial"}
                {item.tag ? " · " + item.tag : ""}
              </Muted>
            </View>
            {item.joined ? <Check size={16} color={palette.accent} /> : null}
            <ChevronRight size={18} color={palette.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View>
            {loading || error ? null : (
              <Empty
                title={
                  query
                    ? "No matching sessions"
                    : filter === "joined"
                      ? "No joined sessions yet."
                      : "No sessions yet."
                }
                icon={
                  <Compass size={38} strokeWidth={1.2} color={palette.accent} />
                }
              >
                <Button kind="text" arrow onPress={() => setShowCode(true)}>
                  Have a code?
                </Button>
              </Empty>
            )}
          </View>
        }
      />
      {selected ? (
        <Dialog
          title={selected.title}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <Muted>
            {selected.kind === "exam" ? "Exam" : "Tutorial"}
            {selected.visibility === "private" ? " · Private" : ""}
          </Muted>
          {selected.tag ? (
            <Text style={{ marginVertical: 14 }}>{selected.tag}</Text>
          ) : null}
          {selected.startsAt ? (
            <Muted>{new Date(selected.startsAt).toLocaleString()}</Muted>
          ) : null}
          {selected.status === "ended" ? (
            <Muted>This session has ended.</Muted>
          ) : selected.joined ? (
            <View style={{ gap: 12, marginTop: 20 }}>
              <Check size={19} color={palette.accent} />
              <Text>You’re in.</Text>
              <Muted>Waiting for your tutor.</Muted>
            </View>
          ) : (
            <Button
              arrow
              busy={busy}
              onPress={() => void join()}
              style={{ marginTop: 20 }}
            >
              Join session
            </Button>
          )}
          {joinError ? <ErrorText>{joinError}</ErrorText> : null}
        </Dialog>
      ) : null}
    </View>
  );
}
