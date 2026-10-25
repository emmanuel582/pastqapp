import { registerTransferRecovery } from "../services/backgroundTransfers";
import {
  savedDownloadSelection,
  groupDownloadPapers,
} from "../domain/downloads";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import Download from "lucide-react-native/icons/download";
import Check from "lucide-react-native/icons/check";
import Pause from "lucide-react-native/icons/pause";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Content,
  Title,
  Text,
  Muted,
  Checkbox,
  Button,
  Row,
  ErrorText,
  Loading,
} from "../components/ui";
import Scholar from "../components/Scholar";
import ScholarActivity from "../components/ScholarActivity";
import {
  manifest,
  prepareDownload,
  download,
  formatBytes,
  type Manifest,
} from "../services/library";
import * as records from "../storage/records";
import type { Props } from "../navigation/types";
import { fonts } from "../theme/tokens";
type Entry = { manifest: Manifest; selected: string[] };
export default function DownloadScreen({
  route,
  navigation,
}: Props<"Download">) {
  const { owner, palette, saved, refreshSaved } = useApp(),
    { ids, title, mode = "select" } = route.params;
  const [entries, setEntries] = useState<Record<string, Entry>>({}),
    [stage, setStage] = useState<"selection" | "transfer" | "complete">(
      mode !== "select" ? "transfer" : "selection",
    ),
    [detail, setDetail] = useState<{ id: string; subject: string } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(false),
    [progress, setProgress] = useState([0, 0]),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [currentTitle, setCurrentTitle] = useState("");
  const controller = useRef<AbortController | null>(null),
    lock = useRef(false),
    auto = useRef(false),
    completed = useRef(new Set<string>()),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    let next = 0;
    setEntries({});
    setError("");
    async function load() {
      while (next < ids.length && !abort.signal.aborted) {
        const id = ids[next++];
        const plan = await records.read<{
          manifest: Manifest;
          selected: string[];
        }>(owner, "download-plan", id);
        let value: Manifest;
        try {
          value = await manifest(id, abort.signal);
        } catch (e) {
          if (!plan) throw e;
          value = plan.manifest;
        }
        const old = saved.find((b) => b.id === id);
        if (!abort.signal.aborted)
          setEntries((previous) => ({
            ...previous,
            [id]: {
              manifest: value,
              selected:
                mode === "all"
                  ? value.parts.map((p) => p.hash)
                  : plan
                    ? savedDownloadSelection(value, {
                        ...plan.manifest.bundle,
                        partialDownload: true,
                        downloadedParts: plan.selected,
                        downloadedSelection: plan.manifest.parts.filter((p) =>
                          plan.selected.includes(p.hash),
                        ),
                      })
                    : savedDownloadSelection(value, old),
            },
          }));
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(3, ids.length) }, load),
    ).catch((e) => {
      if (!abort.signal.aborted) setError(e.message);
    });
    return () => {
      mounted.current = false;
      abort.abort();
      // Leaving this screen keeps native transfers running. Pause is explicit.
    };
  }, [ids, mode, reload]);
  const ready = ids.every((id) => entries[id]),
    jobs = ids.flatMap((id) =>
      entries[id]?.selected.length ? [{ id, ...entries[id] }] : [],
    ),
    parts = jobs.flatMap((job) =>
      job.manifest.parts.filter((p) => job.selected.includes(p.hash)),
    ),
    bytes = parts.reduce((n, p) => n + p.bytes, 0),
    count = parts.reduce((n, p) => n + p.count, 0);
  async function start() {
    if (!ready || !jobs.length || lock.current) return;
    void registerTransferRecovery().catch(() => {});
    lock.current = true;
    setBusy(true);
    setError("");
    setPaused(false);
    setStage("transfer");
    const abort = new AbortController();
    controller.current = abort;
    let done = 0;
    setProgress([0, bytes]);
    const releases: (() => void)[] = [];
    try {
      // Hand every selected material to the native queue before awaiting any one material.
      for (const job of jobs)
        releases.push(
          await prepareDownload(
            owner,
            job.manifest,
            job.selected,
            abort.signal,
          ),
        );
      for (const job of jobs) {
        const size = job.manifest.parts
          .filter((p) => job.selected.includes(p.hash))
          .reduce((n, p) => n + p.bytes, 0);
        if (mounted.current)
          setCurrentTitle(job.manifest.bundle.title || title);
        if (!completed.current.has(job.id)) {
          await download(
            owner,
            job.manifest,
            job.selected,
            abort.signal,
            (value) => {
              if (mounted.current) setProgress([done + value, bytes]);
            },
          );
          completed.current.add(job.id);
        }
        done += size;
        if (mounted.current) setProgress([done, bytes]);
      }
      await refreshSaved();
      if (mounted.current) setStage("complete");
    } catch (e) {
      if (mounted.current) {
        if (abort.signal.aborted) setPaused(true);
        else
          setError(
            e instanceof Error
              ? e.message
              : "Download interrupted. Tap Resume to retry.",
          );
      }
    } finally {
      for (const release of releases) release();
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (mode !== "select" && ready && !auto.current) {
      auto.current = true;
      if (jobs.length) void start();
      else {
        setStage("selection");
        setError("Choose a subject to continue this download.");
      }
    }
  }, [ready, mode]);
  function toggle(id: string, hashes: string[], checked: boolean) {
    completed.current.delete(id);
    setEntries((old) => ({
      ...old,
      [id]: {
        ...old[id],
        selected: checked
          ? [...new Set([...old[id].selected, ...hashes])]
          : old[id].selected.filter((h) => !hashes.includes(h)),
      },
    }));
  }
  const rows = detail
    ? entries[detail.id]?.manifest.parts.filter(
        (p) => p.subject === detail.subject,
      ) || []
    : [];
  return (
    <Screen>
      <Header
        title={detail ? detail.subject : title || "Download"}
        onBack={() => (detail ? setDetail(null) : navigation.goBack())}
      />
      {!ready ? (
        <Content>
          {error ? (
            <>
              <ErrorText>{error}</ErrorText>
              <Button kind="text" onPress={() => setReload((v) => v + 1)}>
                Try again
              </Button>
            </>
          ) : (
            <Loading label="Loading download details" />
          )}
        </Content>
      ) : stage === "selection" ? (
        <Content style={{ paddingTop: 18 }}>
          {detail
            ? groupDownloadPapers(rows).map((part) => (
                <Row
                  key={part.id}
                  title={part.title}
                  onPress={() =>
                    toggle(
                      detail.id,
                      part.hashes,
                      !part.hashes.every((h) =>
                        entries[detail.id].selected.includes(h),
                      ),
                    )
                  }
                  detail={
                    part.count + " questions · " + formatBytes(part.bytes)
                  }
                  right={
                    <Checkbox
                      label={"Download " + part.title}
                      checked={part.hashes.every((h) =>
                        entries[detail.id].selected.includes(h),
                      )}
                      onPress={() =>
                        toggle(
                          detail.id,
                          part.hashes,
                          !part.hashes.every((h) =>
                            entries[detail.id].selected.includes(h),
                          ),
                        )
                      }
                    />
                  }
                />
              ))
            : ids.map((id) => {
                const entry = entries[id],
                  subjects = [
                    ...new Set(entry.manifest.parts.map((p) => p.subject)),
                  ];
                return (
                  <View key={id}>
                    {ids.length > 1 ? (
                      <Title
                        size={19}
                        style={{ marginTop: 20, marginBottom: 12 }}
                      >
                        {entry.manifest.bundle.title}
                      </Title>
                    ) : null}
                    {subjects.map((subject) => {
                      const group = entry.manifest.parts.filter(
                          (p) => p.subject === subject,
                        ),
                        checked = group.every((p) =>
                          entry.selected.includes(p.hash),
                        );
                      return (
                        <View
                          key={subject}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: palette.line,
                          }}
                        >
                          <Checkbox
                            label={"Download " + subject}
                            checked={checked}
                            onPress={() =>
                              toggle(
                                id,
                                group.map((p) => p.hash),
                                !checked,
                              )
                            }
                          />
                          <Pressable
                            onPress={() => setDetail({ id, subject })}
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                              paddingVertical: 18,
                            }}
                          >
                            <View style={{ flex: 1, gap: 5 }}>
                              <Text style={{ fontFamily: fonts.semibold }}>
                                {subject}
                              </Text>
                              <Muted>
                                {group.reduce((n, p) => n + p.count, 0)}{" "}
                                questions ·{" "}
                                {formatBytes(
                                  group.reduce((n, p) => n + p.bytes, 0),
                                )}
                              </Muted>
                            </View>
                            <ChevronRight size={18} color={palette.muted} />
                          </Pressable>
                        </View>
                      );
                    })}
                    <Button
                      kind="text"
                      onPress={() =>
                        toggle(
                          id,
                          entry.manifest.parts.map((p) => p.hash),
                          true,
                        )
                      }
                    >
                      Select all subjects
                    </Button>
                  </View>
                );
              })}
          <Muted style={{ marginTop: 24 }}>
            {count.toLocaleString()} questions · {formatBytes(bytes)}
          </Muted>
          <Button
            arrow
            disabled={!jobs.length}
            onPress={() => void start()}
            style={{ marginTop: 24 }}
          >
            Download subjects
          </Button>
        </Content>
      ) : (
        <Content center>
          <View style={{ alignItems: "center", gap: 20 }}>
            {stage === "complete" || paused ? (
              <Scholar state={stage === "complete" ? "celebrate" : "waiting"} width={192} animated={false} />
            ) : (
              <ScholarActivity mode="download" height={208} width={192} />
            )}
            <Title size={32} style={{ textAlign: "center" }}>
              {stage === "complete"
                ? "Ready offline."
                : paused
                  ? "Download paused."
                  : "Saving your subjects."}
            </Title>
            <Muted>{currentTitle || title}</Muted>
            <View
              style={{
                width: "100%",
                height: 3,
                backgroundColor: palette.line,
              }}
            >
              <View
                style={{
                  height: 3,
                  width: ((progress[1]
                    ? (progress[0] / progress[1]) * 100
                    : 0) + "%") as `${number}%`,
                  backgroundColor: palette.accent,
                }}
              />
            </View>
            <Muted>
              {formatBytes(progress[0])} of {formatBytes(progress[1] || bytes)}
            </Muted>
            {error ? <ErrorText>{error}</ErrorText> : null}
            {stage === "complete" ? (
              <>
                <Check size={24} color={palette.accent} />
                <Button
                  arrow
                  onPress={() =>
                    navigation.navigate("Main", { tab: "library" })
                  }
                >
                  View saved subjects
                </Button>
                {ids.length === 1 ? (
                  <Button
                    kind="text"
                    onPress={() =>
                      navigation.replace("Setup", { bundleId: ids[0] })
                    }
                  >
                    Start practice
                  </Button>
                ) : null}
              </>
            ) : busy ? (
              <Button
                kind="secondary"
                onPress={() => controller.current?.abort()}
              >
                <Pause size={17} color={palette.ink} />
                <Text>Pause</Text>
              </Button>
            ) : (
              <Button arrow onPress={() => void start()}>
                Resume
              </Button>
            )}
          </View>
        </Content>
      )}
    </Screen>
  );
}
