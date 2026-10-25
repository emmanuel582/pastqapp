import { usePreventRemove } from "@react-navigation/native";
import { rememberPendingUpload } from "../services/uploadHistory";
import { registerTransferRecovery } from "../services/backgroundTransfers";
import { stageUploadFiles } from "../services/uploadTransport";
import { checkCancelled } from "../domain/cancellation";
import {
  materialPickerTypes,
  materialMimeType,
  supportedMaterial,
} from "../domain/files";
import { useEffect, useRef, useState } from "react";
import { View, ScrollView } from "react-native";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import Upload from "lucide-react-native/icons/upload";
import Camera from "lucide-react-native/icons/camera";
import BookOpen from "lucide-react-native/icons/book-open";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import ArrowDown from "lucide-react-native/icons/arrow-down";
import FileText from "lucide-react-native/icons/file-text";
import X from "lucide-react-native/icons/x";
import Plus from "lucide-react-native/icons/plus";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Dialog,
  Header,
  Content,
  Text,
  Muted,
  Button,
  Field,
  IconButton,
  Row,
  ErrorText,
} from "../components/ui";
import PaperArt from "../components/PaperArt";
import MaterialCamera from "../components/MaterialCamera";
import ScholarActivity from "../components/ScholarActivity";
import { uploadMaterial, type UploadDraft } from "../services/uploads";
import { formatBytes } from "../services/library";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function UploadScreen({ navigation }: Props<"Upload">) {
  const { owner, palette } = useApp();
  const [draft, setDraft] = useState<UploadDraft>({ files: [], name: "" }),
    [loadedOwner, setLoadedOwner] = useState<string | null>(null),
    [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ done: 0, total: 0, label: "" }),
    [error, setError] = useState(""),
    lock = useRef(false);
  const uploadAccepted = useRef(false);
  const [leaveBlocked, setLeaveBlocked] = useState(false);
  usePreventRemove(busy, ({ data }) => {
    if (uploadAccepted.current) navigation.dispatch(data.action);
    else setLeaveBlocked(true);
  });
  const transfer = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Screen navigation does not cancel a native transfer. Account changes do.
  const transferOwner = useRef(owner);
  useEffect(() => {
    if (transferOwner.current !== owner) transfer.current?.abort();
    transferOwner.current = owner;
  }, [owner]);
  useEffect(() => {
    let active = true;
    void records
      .read<UploadDraft>(owner, "upload", "draft")
      .then((value) => {
        if (active) setDraft(value || { files: [], name: "" });
      })
      .finally(() => {
        if (active) setLoadedOwner(owner);
      });
    return () => {
      active = false;
    };
  }, [owner]);
  useEffect(() => {
    if (loadedOwner === owner && !busy)
      void records.write(owner, "upload", "draft", draft).catch(() => {});
  }, [draft, loadedOwner, owner, busy]);
  async function choose() {
    if (busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: materialPickerTypes,
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled)
        setDraft((d) => ({
          ...d,
          sessionId: undefined,
          started: false,
          files: [
            ...d.files,
            ...result.assets
              .map((a) => ({
                uri: a.uri,
                name: a.name,
                mimeType: materialMimeType(a.name, a.mimeType),
                size: a.size || 0,
                file: a.file,
              }))
              .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true }),
              ),
          ],
        }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not choose these files.",
      );
    }
  }
  function move(index: number, direction: number) {
    setDraft((d) => {
      const files = [...d.files],
        other = index + direction;
      if (other < 0 || other >= files.length) return d;
      [files[index], files[other]] = [files[other], files[index]];
      return { ...d, files, sessionId: undefined, started: false };
    });
  }
  async function submit() {
    if (lock.current || !draft.files.length) return;
    void registerTransferRecovery().catch(() => {});
    lock.current = true;
    uploadAccepted.current = false;
    setBusy(true);
    setError("");
    try {
      const abort = new AbortController();
      transfer.current = abort;
      if (draft.files.some((f) => !supportedMaterial(f.name)))
        throw Error("Choose a supported photo or document.");
      const files = await stageUploadFiles(owner, draft.files);
      checkCancelled(abort.signal);
      const staged = { ...draft, files, started: true };
      await records.write(owner, "upload", "draft", staged);
      if (mounted.current) setDraft(staged);
      let persisted = staged;
      const id = await uploadMaterial(
        files,
        draft.name,
        (done, total, label) => {
          if (mounted.current) setProgress({ done, total, label });
        },
        draft.sessionId,
        async (sessionId) => {
          const next = { ...staged, sessionId };
          const updated = await records.compareAndSwap(
            owner,
            "upload",
            "draft",
            persisted,
            next,
          );
          await rememberPendingUpload(owner, sessionId, draft.name);
          persisted = next;
          if (updated && mounted.current) setDraft(next);
        },
        abort.signal,
      );
      checkCancelled(abort.signal);
      const cleared = await records.compareAndSwap(
        owner,
        "upload",
        "draft",
        persisted,
        null,
      );
      if (cleared) await records.write(owner, "processing", "current", id);
      uploadAccepted.current = true;
      await rememberPendingUpload(owner, id, draft.name, "processing");
      if (mounted.current) setLeaveBlocked(false);
      if (cleared && mounted.current) {
        setDraft({ files: [], name: "" });
        navigation.replace("Processing", { sessionId: id });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your upload did not finish. Please try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title="Upload material" onBack={() => navigation.goBack()} />
      <Content
        style={{
          paddingTop: 30,
          paddingHorizontal: 24,
          paddingBottom: 40,
          maxWidth: 600,
        }}
      >
        <View
          style={{
            padding: 24,
            borderWidth: 1,
            borderColor: palette.line,
            borderRadius: 8,
            backgroundColor: palette.panel,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -1,
              left: 30,
              width: 42,
              height: 2,
              backgroundColor: palette.accent,
            }}
          />
          {!draft.files.length ? (
            <View style={{ alignItems: "center", gap: 12 }}>
              <PaperArt />
              <View style={{ width: "100%" }}>
                <Button onPress={() => void choose()} style={{ marginTop: 20 }}>
                  <Upload size={18} color={palette.onButton} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontFamily: fonts.bold,
                      color: palette.onButton,
                    }}
                  >
                    Choose files
                  </Text>
                  <ArrowRight size={18} color={palette.onButton} />
                </Button>
              </View>
            </View>
          ) : (
            <>
              <Field
                label="Material name"
                placeholder="e.g. Chemistry revision"
                value={draft.name}
                onChangeText={(name) =>
                  setDraft((d) => ({
                    ...d,
                    name,
                    sessionId: undefined,
                    started: false,
                  }))
                }
                editable={!busy}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 25,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: fonts.semibold }}>
                  {draft.files.length} file{draft.files.length === 1 ? "" : "s"}{" "}
                  selected
                </Text>
                <Button
                  kind="text"
                  disabled={busy}
                  onPress={() => void choose()}
                >
                  <Plus size={16} color={palette.accent} />
                  <Text style={{ fontSize: 12, color: palette.accent }}>
                    Add files
                  </Text>
                </Button>
              </View>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 340 }}>
                {draft.files.map((file, index) => (
                  <View
                    key={file.uri + index}
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      minHeight: 82,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: palette.line,
                    }}
                  >
                    <Muted style={{ fontSize: 10, minWidth: 18 }}>
                      {String(index + 1).padStart(2, "0")}
                    </Muted>
                    <View
                      style={{
                        width: 42,
                        height: 52,
                        borderWidth: 1,
                        borderColor: palette.line,
                        borderRadius: 3,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {file.mimeType.startsWith("image/") ? (
                        <Image
                          source={file.uri}
                          contentFit="cover"
                          style={{ width: 42, height: 52 }}
                        />
                      ) : (
                        <FileText size={20} color={palette.artInk} />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 80, gap: 6 }}>
                      <Text style={{ fontSize: 12 }}>{file.name}</Text>
                      <Muted style={{ fontSize: 10 }}>
                        {formatBytes(file.size)}
                      </Muted>
                    </View>
                    <View style={{ flexDirection: "row", marginLeft: "auto" }}>
                      <IconButton
                        label={"Move " + file.name + " up"}
                        disabled={busy || index === 0}
                        onPress={() => move(index, -1)}
                        style={{ width: 34 }}
                      >
                        <ArrowUp size={16} color={palette.muted} />
                      </IconButton>
                      <IconButton
                        label={"Move " + file.name + " down"}
                        disabled={busy || index === draft.files.length - 1}
                        onPress={() => move(index, 1)}
                        style={{ width: 34 }}
                      >
                        <ArrowDown size={16} color={palette.muted} />
                      </IconButton>
                      <IconButton
                        label={"Remove " + file.name}
                        disabled={busy}
                        onPress={() =>
                          setDraft((d) => ({
                            ...d,
                            sessionId: undefined,
                            started: false,
                            files: d.files.filter((_, i) => i !== index),
                          }))
                        }
                        style={{ width: 34 }}
                      >
                        <X size={17} color={palette.muted} />
                      </IconButton>
                    </View>
                  </View>
                ))}
              </ScrollView>
              {busy ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <ScholarActivity mode="upload" width={106} height={116} />
                  <View style={{ flex: 1, gap: 12 }}>
                    <Muted>{progress.label || "Preparing your material"}</Muted>
                    <View style={{ height: 3, backgroundColor: palette.line }}>
                      <View
                        style={{
                          height: 3,
                          width: ((progress.total
                            ? (progress.done / progress.total) * 100
                            : 0) + "%") as `${number}%`,
                          backgroundColor: palette.accent,
                        }}
                      />
                    </View>
                  </View>
                </View>
              ) : null}
              <Button
                disabled={busy}
                busy={busy}
                onPress={() => void submit()}
                style={{ marginTop: 24 }}
              >
                <Text
                  style={{
                    color: palette.onButton,
                    fontFamily: fonts.bold,
                    flex: 1,
                  }}
                >
                  {busy ? "Uploading…" : "Prepare questions"}
                </Text>
                <Upload size={18} color={palette.onButton} />
              </Button>
            </>
          )}
          {error ? (
            <>
              <ErrorText>{error}</ErrorText>
              {/sign in/i.test(error) ? (
                <Button
                  kind="secondary"
                  onPress={() => navigation.navigate("Auth", { mode: "login" })}
                >
                  Sign in
                </Button>
              ) : null}
            </>
          ) : null}
        </View>
        {!busy ? (
          <View style={{ marginTop: 14 }}>
            <Row
              title="Take a photo"
              icon={
                <Camera size={21} color={palette.accent} strokeWidth={1.5} />
              }
              onPress={() => setCamera(true)}
              right={<ArrowRight size={18} color={palette.muted} />}
              style={{ minHeight: 64 }}
            />
            <Row
              title="Paste questions instead"
              icon={
                <BookOpen size={21} color={palette.accent} strokeWidth={1.5} />
              }
              onPress={() => navigation.navigate("Manual")}
              right={<ArrowRight size={18} color={palette.muted} />}
              style={{ minHeight: 64 }}
            />
          </View>
        ) : null}
      </Content>
      {leaveBlocked ? (
        <Dialog title="Uploading files" onClose={() => setLeaveBlocked(false)}>
          <Button onPress={() => setLeaveBlocked(false)}>Keep uploading</Button>
        </Dialog>
      ) : null}
      {camera ? (
        <MaterialCamera
          onClose={() => setCamera(false)}
          onCapture={(file) => {
            setCamera(false);
            setDraft((d) => ({
              ...d,
              files: [...d.files, file],
              sessionId: undefined,
              started: false,
            }));
          }}
        />
      ) : null}
    </Screen>
  );
}
