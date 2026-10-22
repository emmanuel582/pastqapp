import { removeIndex } from "../storage/bank";
import { listAttempts, readAttempt, saveAttempt } from "../storage/practice";
import React, { useState } from "react";
import { View } from "react-native";
import Database from "lucide-react-native/icons/database";
import Trash2 from "lucide-react-native/icons/trash";
import Download from "lucide-react-native/icons/download";
import Upload from "lucide-react-native/icons/upload";
import {
  Screen,
  Header,
  Content,
  Text,
  Muted,
  Button,
  Tabs,
  Row,
  IconButton,
  Dialog,
  ErrorText,
} from "../components/ui";
import { useApp } from "../state/AppContext";
import * as records from "../storage/records";
import { formatBytes } from "../services/library";
import { exportBackup, importBackup } from "../services/backup";
import { shareJson, chooseJson } from "../services/files";
import type { Bundle } from "../domain/types";
import type { Props } from "../navigation/types";
export default function StorageScreen({ navigation }: Props<"Storage">) {
  const { owner, palette, saved, refreshSaved, refreshPractice } = useApp();
  const [tab, setTab] = useState<"downloads" | "backup">("downloads"),
    [remove, setRemove] = useState<Bundle | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await work();
      await refreshSaved();
      await refreshPractice();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not finish. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title="Storage & backup" onBack={() => navigation.goBack()} />
      <Content style={{ paddingTop: 14 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "downloads", label: "Downloads" },
            { id: "backup", label: "Backup" },
          ]}
        />
        {tab === "downloads" ? (
          <>
            <Row
              title={
                formatBytes(
                  saved.reduce((n, b) => n + (b.downloadBytes || 0), 0),
                ) + " on this device"
              }
              icon={<Database size={22} color={palette.accent} />}
            />
            <Muted style={{ marginTop: 14 }}>App ready to open offline.</Muted>
            {saved.map((bundle) => (
              <Row
                key={bundle.id}
                title={bundle.title}
                detail={
                  (
                    bundle.question_count || bundle.questions.length
                  ).toLocaleString() +
                  " questions · " +
                  formatBytes(bundle.downloadBytes || 0)
                }
                right={
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {!bundle.sourceSessionId ? (
                      <Button
                        kind="text"
                        disabled={busy}
                        onPress={() =>
                          navigation.navigate("Download", {
                            ids: [bundle.id],
                            title: bundle.title,
                          })
                        }
                      >
                        Update
                      </Button>
                    ) : null}
                    <IconButton
                      label={"Remove download " + bundle.title}
                      disabled={busy}
                      onPress={() => setRemove(bundle)}
                    >
                      <Trash2 size={18} color={palette.muted} />
                    </IconButton>
                  </View>
                }
              />
            ))}
            {!saved.length ? (
              <Muted style={{ marginTop: 20 }}>No downloaded materials.</Muted>
            ) : null}
            <Button
              kind="secondary"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  for (const b of saved)
                    for (const hash of b.downloadedParts || [])
                      await records.remove(
                        owner,
                        "download-part",
                        b.id + ":" + hash,
                      );
                  setStatus("Temporary download parts cleared.");
                })
              }
              style={{ marginTop: 20 }}
            >
              Clear temporary parts
            </Button>
          </>
        ) : (
          <>
            <Muted style={{ marginTop: 14 }}>
              Keep a private copy of your sessions, diagrams, saved questions
              and notes. Restore it while signed into the same account. Keep
              this file somewhere safe.
            </Muted>
            <Button
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await shareJson(
                    "PastQ-study-" +
                      new Date().toISOString().slice(0, 10) +
                      ".json",
                    await exportBackup(owner),
                  );
                  setStatus("Backup prepared. Save it to a private location.");
                })
              }
              style={{ marginTop: 20 }}
            >
              <Download size={17} color={palette.onButton} />
              <Text style={{ color: palette.onButton }}>
                Export study backup
              </Text>
            </Button>
            <Button
              kind="secondary"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const text = await chooseJson();
                  if (text) {
                    const result = await importBackup(owner, text);
                    setStatus(
                      "Restored " +
                        result.sessions +
                        " sessions and " +
                        result.bookmarks +
                        " saved questions.",
                    );
                  }
                })
              }
              style={{ marginTop: 20 }}
            >
              <Upload size={17} color={palette.ink} />
              <Text>Restore backup</Text>
            </Button>
          </>
        )}
        {busy ? <Muted style={{ marginTop: 20 }}>Working…</Muted> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {status ? <Muted style={{ marginTop: 20 }}>{status}</Muted> : null}
      </Content>
      {remove ? (
        <Dialog
          title="Remove this download?"
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <Muted>
            Past sessions and saved questions keep their own diagrams and
            answers.
          </Muted>
          <Button
            kind="secondary"
            disabled={busy}
            onPress={() => setRemove(null)}
            style={{ marginTop: 22 }}
          >
            Keep download
          </Button>
          <Button
            busy={busy}
            onPress={() =>
              void run(async () => {
                // Older development sessions may still reference the bank. Archive them before freeing it.
                for (const header of await listAttempts(owner))
                  if (header.bundleId === remove.id) {
                    const attempt = await readAttempt(owner, header.id);
                    if (attempt.questions.some((q) => q.nativeRef))
                      await saveAttempt(attempt, true);
                  }
                await removeIndex(owner, remove.id);
                await records.remove(owner, "bundle", remove.id);
                await records.remove(owner, "bundle-meta", remove.id);
                for (const hash of remove.downloadedParts || [])
                  await records.remove(
                    owner,
                    "download-part",
                    remove.id + ":" + hash,
                  );
                setRemove(null);
              })
            }
            style={{ marginTop: 12 }}
          >
            Remove download
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
