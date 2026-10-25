import { hasOpenUploadChecks } from "../domain/uploadReview";
import { rememberUpload } from "../services/uploadHistory";
import { confirmedMaterial } from "../services/confirmedMaterial";
import { missingPageInsertion, processingFollowUp } from "../domain/processing";
import React, { useEffect, useRef, useState } from "react";
import { View, AppState } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Content,
  Title,
  Text,
  Muted,
  Button,
  ErrorText,
} from "../components/ui";
import Scholar from "../components/Scholar";
import ScholarActivity from "../components/ScholarActivity";
import {
  visionSession,
  resumeVision,
  replyVision,
  appendFile,
  insertVisionPage,
} from "../services/uploads";
import type { VisionSession } from "../domain/types";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function ProcessingScreen({
  route,
  navigation,
}: Props<"Processing">) {
  const { palette, owner } = useApp();
  const [session, setSession] = useState<VisionSession | null>(null),
    [interrupted, setInterrupted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const finish = useRef(false);
  const [pollRevision, setPollRevision] = useState(0);
  useEffect(() => {
    finish.current = false;
    let mounted = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    let polling = false;
    async function poll() {
      if (!mounted || polling || AppState.currentState !== "active") return;
      polling = true;
      try {
        const value = await visionSession(route.params.sessionId, abort.signal);
        if (!mounted) return;
        const confirmed = await confirmedMaterial(owner, value);
        if (!mounted) return;
        if (confirmed) {
          finish.current = true;
          navigation.replace("Setup", { bundleId: confirmed });
          return;
        }
        setSession(value);
        setInterrupted(false);
        await rememberUpload(owner, value);
        if (
          ["completed", "completed_with_errors"].includes(value.status) &&
          value.questions?.length &&
          !finish.current &&
          !hasOpenUploadChecks(value)
        ) {
          finish.current = true;
          navigation.replace("ReviewMaterial", { sessionId: value.id });
          return;
        }
        if (hasOpenUploadChecks(value)) return;
        if (
          ["failed", "paused", "needs_input", "needs_attention"].includes(
            value.status,
          )
        )
          return;
      } catch {
        if (mounted) setInterrupted(true);
      } finally {
        polling = false;
      }
      if (mounted) timer = setTimeout(() => void poll(), 2000);
    }
    void poll();
    const sub = AppState.addEventListener("change", (state) => {
      clearTimeout(timer);
      if (state === "active") void poll();
    });
    return () => {
      mounted = false;
      abort.abort();
      clearTimeout(timer);
      sub.remove();
    };
  }, [route.params.sessionId, owner, pollRevision]);
  const failed =
      session?.status === "failed" ||
      (!!session &&
        ["completed", "completed_with_errors"].includes(session.status) &&
        !session.questions?.length),
    waiting =
      ["needs_input", "paused", "needs_attention"].includes(
        session?.status || "",
      ) || (session?.followUps || []).some((f) => f.status === "open"),
    state = interrupted
      ? "interrupted"
      : failed
        ? "failed"
        : waiting
          ? "waiting"
          : "preparing",
    title =
      state === "interrupted"
        ? "Reconnecting"
        : state === "failed"
          ? "Couldn’t prepare questions"
          : state === "waiting"
            ? session?.status === "paused"
              ? "Preparation paused"
              : "Check this page"
            : "Preparing your questions",
    progress = session?.progress?.total
      ? Math.min(
          99,
          Math.round((session.progress.done / session.progress.total) * 100),
        )
      : null;
  async function act(work: () => Promise<VisionSession>) {
    setBusy(true);
    setError("");
    try {
      setSession(await work());
      setPollRevision((value) => value + 1);
    } catch {
      setError("That didn’t work. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function attach(item: NonNullable<VisionSession["followUps"]>[number]) {
    if (busy || !session) return;
    setBusy(true);
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const image = result.assets[0],
        file = {
          uri: image.uri,
          name: image.name,
          mimeType: image.mimeType || "image/jpeg",
          size: image.size || 0,
          file: image.file,
        };
      if (item.type === "missing_page") {
        const insertAt = missingPageInsertion(session, item);
        await insertVisionPage(session.id, file, insertAt);
        const form = new FormData();
        form.append("followUpId", item.id);
        form.append("action", "acknowledged");
        setSession(await replyVision(session.id, form));
      } else {
        const form = new FormData();
        form.append("followUpId", item.id);
        form.append("action", "replace_page");
        await appendFile(form, "image", file);
        setSession(await replyVision(session.id, form));
      }
      setPollRevision((value) => value + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not add this page. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Content
        style={{
          paddingHorizontal: 30,
          paddingTop: 12,
          paddingBottom: 40,
          maxWidth: 440,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <View style={{ alignItems: "center", gap: 20 }}>
          {failed || waiting || interrupted ? (
            <Scholar
              state={failed ? "encourage" : "waiting"}
              width={100}
              sceneWidth={130}
              sceneHeight={130}
            />
          ) : (
            <ScholarActivity mode="processing" height={260} width={240} />
          )}
          <Title
            size={34}
            style={{
              fontFamily: fonts.serifMedium,
              textAlign: "center",
              letterSpacing: -1.5,
            }}
          >
            {title}
          </Title>
          {!waiting && !failed && !interrupted ? (
            <View style={{ width: "100%", marginTop: 30 }}>
              {progress !== null ? (
                <Text
                  style={{ textAlign: "right", fontSize: 20, marginBottom: 12 }}
                >
                  {progress}
                  <Muted>%</Muted>
                </Text>
              ) : null}
              <View
                accessibilityRole="progressbar"
                style={{ height: 3, backgroundColor: palette.line }}
              >
                <View
                  style={{
                    height: 3,
                    width: ((progress ?? 32) + "%") as `${number}%`,
                    backgroundColor: palette.accent,
                  }}
                />
              </View>
            </View>
          ) : null}
          {!failed && !waiting ? <></> : null}
          <Button
            kind="text"
            onPress={() => navigation.navigate("Notifications")}
          >
            Notifications
          </Button>
          {interrupted ? <></> : failed ? <></> : null}
          {session?.followUps
            ?.filter((f) => f.status === "open")
            .map((item) => (
              <View
                key={item.id}
                style={{
                  width: "100%",
                  gap: 12,
                  marginTop: 15,
                  paddingTop: 15,
                  borderTopWidth: 1,
                  borderTopColor: palette.line,
                }}
              >
                <Muted>{processingFollowUp(item).message}</Muted>
                {processingFollowUp(item).photo ? (
                  <Button disabled={busy} onPress={() => void attach(item)}>
                    {item.type === "missing_page"
                      ? "Add missing page"
                      : "Add clearer photo"}
                  </Button>
                ) : null}
                {processingFollowUp(item).canSkip ? (
                  <Button
                    kind="secondary"
                    disabled={busy}
                    onPress={() => {
                      const form = new FormData();
                      form.append("followUpId", item.id);
                      form.append("action", "dismiss");
                      void act(() => replyVision(session.id, form));
                    }}
                  >
                    Skip this check
                  </Button>
                ) : null}
              </View>
            ))}
          {failed || waiting ? (
            <Button
              busy={busy}
              onPress={() =>
                void act(() => resumeVision(route.params.sessionId))
              }
            >
              Try again
            </Button>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button kind="text" onPress={() => navigation.popTo("Uploads")}>
            Back to uploads
          </Button>
        </View>
      </Content>
    </Screen>
  );
}
