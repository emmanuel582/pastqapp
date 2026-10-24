import { campaignDestination } from "../domain/notifications";
import * as records from "../storage/records";
import {
  pushStatus,
  quietPush,
  connectPush,
  disablePush,
  testPush,
} from "../services/remotePush";
import React, { useEffect, useState } from "react";
import { View, FlatList, AppState } from "react-native";
import Bell from "lucide-react-native/icons/bell";
import Check from "lucide-react-native/icons/check";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { Image } from "expo-image";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Text,
  Title,
  Muted,
  Button,
  IconButton,
  Empty,
  ErrorText,
  Loading,
} from "../components/ui";
import { request, json, apiUrl } from "../services/api";
import type { Props } from "../navigation/types";
import { fonts } from "../theme/tokens";
interface InboxItem {
  id: string;
  title: string;
  body: string;
  imageId: string | null;
  deepLink: string;
  sent_at: string;
  read_at: string | null;
}
interface Inbox {
  items: InboxItem[];
  total: number;
  unread: number;
}
export default function NotificationsScreen({
  navigation,
}: Props<"Notifications">) {
  const { owner, palette, session } = useApp();
  const [snapshot, setSnapshot] = useState<Inbox | null>(null),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;
    async function load() {
      try {
        const value = await request<Inbox>(
          "/api/reminders/inbox?offset=" + offset,
          { signal: abort.signal },
          true,
        );
        if (!abort.signal.aborted) {
          void records
            .write(owner, "inbox-cache", String(offset), value)
            .catch(() => {});
          setSnapshot(value);
          setError("");
        }
      } catch (e) {
        const cached = await records
          .read<Inbox>(owner, "inbox-cache", String(offset))
          .catch(() => null);
        if (cached && !abort.signal.aborted) setSnapshot(cached);
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load notifications.",
          );
      }
    }
    function resume(state: string) {
      clearInterval(timer);
      if (state === "active") {
        void load();
        timer = setInterval(() => void load(), 15000);
      }
    }
    resume(AppState.currentState || "active");
    const sub = AppState.addEventListener("change", resume);
    return () => {
      abort.abort();
      clearInterval(timer);
      sub.remove();
    };
  }, [owner, offset, revision]);
  const [pushQuiet, setPushQuiet] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false),
    [pushBusy, setPushBusy] = useState(false),
    [pushMessage, setPushMessage] = useState("");
  useEffect(() => {
    let alive = true;
    void Promise.all([pushStatus(owner), quietPush()])
      .then(([enabled, quiet]) => {
        if (alive) {
          setPushEnabled(enabled);
          setPushQuiet(quiet);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [owner, revision]);
  async function changePush() {
    setPushBusy(true);
    setPushMessage("");
    try {
      if (pushEnabled) {
        await disablePush(owner);
        setPushEnabled(false);
      } else {
        await connectPush(owner);
        setPushEnabled(true);
      }
    } catch (e) {
      setPushMessage(
        e instanceof Error
          ? e.message
          : "Could not update phone notifications. Try again.",
      );
    } finally {
      setPushBusy(false);
    }
  }
  async function sendPushTest() {
    setPushBusy(true);
    setPushMessage("");
    try {
      await testPush();
      setPushMessage("Test queued. Lock your phone to check the notification.");
    } catch (e) {
      setPushMessage(
        e instanceof Error ? e.message : "Could not send the test. Try again.",
      );
    } finally {
      setPushBusy(false);
    }
  }
  async function mark(id: string) {
    setBusy(id);
    try {
      await request(
        "/api/reminders/inbox/" + encodeURIComponent(id) + "/read",
        json("POST", {}),
        true,
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not mark this notification as read.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <Screen>
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            label="Refresh notifications"
            onPress={() => setRevision((v) => v + 1)}
          >
            <RefreshCw size={18} color={palette.muted} />
          </IconButton>
        }
      />
      <FlatList
        data={snapshot?.items || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 22,
          paddingTop: 24,
          width: "100%",
          maxWidth: 744,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View>
            <View
              style={{
                paddingBottom: 20,
                marginBottom: 20,
                borderBottomWidth: 1,
                borderColor: palette.line,
                gap: 12,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold }}>
                Phone notifications
              </Text>
              <></>
              <Button
                kind="secondary"
                disabled={pushBusy || owner === "guest"}
                onPress={() => void changePush()}
              >
                {pushBusy
                  ? "Updating…"
                  : pushEnabled
                    ? "Disable notifications"
                    : "Enable notifications"}
              </Button>
              {pushEnabled && pushQuiet ? (
                <View style={{ gap: 10 }}>
                  <></>
                  <Button
                    kind="text"
                    disabled={pushBusy}
                    onPress={() => {
                      setPushBusy(true);
                      setPushMessage("");
                      void connectPush(owner)
                        .then(async () => setPushQuiet(await quietPush()))
                        .catch((e) =>
                          setPushMessage(
                            e instanceof Error
                              ? e.message
                              : "Could not enable alerts.",
                          ),
                        )
                        .finally(() => setPushBusy(false));
                    }}
                  >
                    Enable banners and sound
                  </Button>
                </View>
              ) : null}
              {pushEnabled ? (
                <Button
                  kind="text"
                  disabled={pushBusy}
                  onPress={() => void sendPushTest()}
                >
                  Test notification
                </Button>
              ) : null}
              {pushMessage ? <Muted>{pushMessage}</Muted> : null}
            </View>
            {
              <>
                {error ? <ErrorText>{error}</ErrorText> : null}
                {snapshot ? (
                  <Muted style={{ marginBottom: 22 }}>
                    {snapshot.unread} unread · {snapshot.total} notifications
                  </Muted>
                ) : !error ? (
                  <Loading label="Loading notifications…" />
                ) : null}
              </>
            }
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              padding: 24,
              backgroundColor: item.read_at ? palette.panel : palette.control,
              borderRadius: 14,
              marginBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 18,
              }}
            >
              <Bell size={16} color={palette.muted} />
              <></>
              <Muted style={{ marginLeft: "auto", fontSize: 9 }}>
                {new Date(item.sent_at).toLocaleString()}
              </Muted>
            </View>
            {item.imageId ? (
              <Image
                source={{
                  uri: apiUrl(
                    "/api/reminders/images/" + encodeURIComponent(item.imageId),
                  ),
                  headers: session
                    ? { Authorization: "Bearer " + session.access_token }
                    : undefined,
                }}
                contentFit="contain"
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 9,
                  marginBottom: 20,
                }}
              />
            ) : null}
            <Title size={20} style={{ lineHeight: 32 }}>
              {item.title}
            </Title>
            <Muted style={{ marginTop: 12, fontSize: 13, lineHeight: 25 }}>
              {item.body}
            </Muted>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 16,
                marginTop: 22,
                flexWrap: "wrap",
              }}
            >
              {item.deepLink !== "/?inbox=1" ? (
                <Button
                  kind="text"
                  arrow
                  onPress={() => {
                    void mark(item.id);
                    const target = campaignDestination(item.deepLink);
                    if (target.screen === "Main")
                      navigation.navigate("Main", { tab: target.tab });
                    else navigation.navigate(target.screen);
                  }}
                >
                  Open
                </Button>
              ) : null}
              {!item.read_at ? (
                <Button
                  kind="text"
                  disabled={busy === item.id}
                  onPress={() => void mark(item.id)}
                >
                  <Check size={15} color={palette.accent} />
                  <Text style={{ fontSize: 12, color: palette.accent }}>
                    {busy === item.id ? "Saving…" : "Mark as read"}
                  </Text>
                </Button>
              ) : (
                <Muted style={{ fontSize: 10 }}>Read</Muted>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View>
            {snapshot ? (
              <Empty
                title="You’re all caught up."
                icon={<Bell size={30} color={palette.accent} />}
              >
                <></>
              </Empty>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View>
            {snapshot ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 25,
                }}
              >
                <Button
                  kind="text"
                  disabled={!offset}
                  onPress={() => setOffset((v) => Math.max(0, v - 20))}
                >
                  Previous
                </Button>
                <Muted style={{ fontSize: 11 }}>
                  {snapshot.total
                    ? offset + 1 + "–" + Math.min(offset + 20, snapshot.total)
                    : 0}{" "}
                  of {snapshot.total}
                </Muted>
                <Button
                  kind="text"
                  disabled={offset + 20 >= snapshot.total}
                  onPress={() => setOffset((v) => v + 20)}
                >
                  Next
                </Button>
              </View>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}
