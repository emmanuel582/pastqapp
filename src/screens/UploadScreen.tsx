import { materialMimeType } from "../domain/files";
import React, { useEffect, useRef, useState } from "react";
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
  Header,
  Content,
  Title,
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
import Scholar from "../components/Scholar";
import {
  uploadMaterial,
  type UploadDraft,
  type UploadFile,
} from "../services/uploads";
import { formatBytes } from "../services/library";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function UploadScreen({ navigation }: Props<"Upload">) {
  const { owner, palette } = useApp();
  const [draft, setDraft] = useState<UploadDraft>({ files: [], name: "" }),
    [loaded, setLoaded] = useState(false),
    [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ done: 0, total: 0, label: "" }),
    [error, setError] = useState(""),
    lock = useRef(false);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  useEffect(() => {
    let active = true;
    void records
      .read<UploadDraft>(owner, "upload", "draft")
      .then((value) => {
        if (active && value) setDraft(value);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [owner]);
  useEffect(() => {
    if (loaded)
      void records.write(owner, "upload", "draft", draft).catch(() => {});
  }, [draft, loaded, owner]);
  async function choose() {
    if (busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf", "text/plain", "application/json"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled)
        setDraft((d) => ({
          ...d,
          sessionId: undefined,
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
      return { ...d, files, sessionId: undefined };
    });
  }
  async function submit() {
    if (lock.current || !draft.files.length) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const abort = new AbortController();
      transfer.current = abort;
      const id = await uploadMaterial(
        draft.files,
        draft.name,
        (done, total, label) => setProgress({ done, total, label }),
        draft.sessionId,
        async (sessionId) => {
          const next = { ...draft, sessionId };
          setDraft(next);
          await records.write(owner, "upload", "draft", next);
        },
        abort.signal,
      );
      abort.signal.throwIfAborted();
      await records.write(owner, "processing", "current", id);
      setDraft({ files: [], name: "" });
      navigation.replace("Processing", { sessionId: id });
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
      <Header onBack={() => navigation.goBack()} />
      <Content
        style={{
          paddingTop: 30,
          paddingHorizontal: 24,
          paddingBottom: 40,
          maxWidth: 600,
        }}
      >
        <Title
          size={36}
          style={{
            fontFamily: fonts.serifMedium,
            letterSpacing: -1.62,
            marginBottom: 26,
          }}
        >
          Upload material
        </Title>
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
                <Muted style={{ textAlign: "center", marginTop: 8 }}>
                  Photos, PDF or text
                </Muted>
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
                  setDraft((d) => ({ ...d, name, sessionId: undefined }))
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
                  <Scholar width={96} sceneWidth={110} sceneHeight={116} />
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
      {camera ? (
        <MaterialCamera
          onClose={() => setCamera(false)}
          onCapture={(file) => {
            setCamera(false);
            setDraft((d) => ({
              ...d,
              files: [...d.files, file],
              sessionId: undefined,
            }));
          }}
        />
      ) : null}
    </Screen>
  );
}
