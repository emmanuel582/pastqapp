import { useCallback, useState } from "react";
import { View, FlatList, AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import {
  Screen,
  Header,
  Text,
  Muted,
  Button,
  IconButton,
  Empty,
  Loading,
  ErrorText,
  Row,
} from "../components/ui";
import { confirmedMaterial } from "../services/confirmedMaterial";
import { useApp } from "../state/AppContext";
import {
  cachedUploads,
  loadUploads,
  type UploadSummary,
} from "../services/uploadHistory";
import { uploadStage, uploadStageLabel } from "../domain/uploadReview";
import * as records from "../storage/records";
import type { UploadDraft } from "../services/uploads";
import type { Props } from "../navigation/types";
export default function UploadsScreen({ navigation }: Props<"Uploads">) {
  const { owner, palette } = useApp();
  const [items, setItems] = useState<UploadSummary[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [limit, setLimit] = useState(30),
    [total, setTotal] = useState(0),
    [opening, setOpening] = useState("");
  useFocusEffect(
    useCallback(() => {
      const abort = new AbortController();
      let polling = false,
        timer: ReturnType<typeof setTimeout> | undefined;
      async function refresh() {
        if (
          polling ||
          abort.signal.aborted ||
          AppState.currentState !== "active"
        )
          return;
        polling = true;
        try {
          const result = await loadUploads(owner, limit, abort.signal);
          if (!abort.signal.aborted) {
            setItems(result.items);
            setTotal(result.total);
            setError("");
          }
        } catch (e) {
          if (!abort.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Could not load uploads.",
            );
        } finally {
          polling = false;
          if (!abort.signal.aborted) {
            setLoaded(true);
            timer = setTimeout(() => void refresh(), 8000);
          }
        }
      }
      void (async () => {
        try {
          const rows = await cachedUploads(owner);
          if (!abort.signal.aborted && rows.length) {
            setItems(rows);
            setLoaded(true);
          }
        } catch {}
        if (!abort.signal.aborted) void refresh();
      })();
      const sub = AppState.addEventListener("change", (state) => {
        clearTimeout(timer);
        if (state === "active") void refresh();
      });
      return () => {
        abort.abort();
        clearTimeout(timer);
        sub.remove();
      };
    }, [owner, limit, revision]),
  );
  async function open(item: UploadSummary) {
    if (opening) return;
    setOpening(item.id);
    try {
      setError("");
      if (item.approvedAt) {
        const id = await confirmedMaterial(owner, item);
        if (id) {
          navigation.navigate("Setup", { bundleId: id });
          return;
        }
      }
      const draft = await records.read<UploadDraft>(owner, "upload", "draft");
      if (uploadStage(item) === "uploading" && draft?.sessionId === item.id)
        navigation.navigate("Upload");
      else navigation.navigate("Processing", { sessionId: item.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this upload.");
    } finally {
      setOpening("");
    }
  }
  return (
    <Screen>
      <Header
        title="Uploads"
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            label="Refresh uploads"
            onPress={() => setRevision((v) => v + 1)}
          >
            <RefreshCw size={19} color={palette.muted} />
          </IconButton>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 22,
          width: "100%",
          maxWidth: 744,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 20 }}>
            <Button onPress={() => navigation.navigate("Upload")}>
              <Plus size={18} color={palette.onButton} />
              <Text style={{ color: palette.onButton }}>New upload</Text>
            </Button>
            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
        }
        ListEmptyComponent={
          !loaded ? <Loading /> : <Empty title="No uploads yet" />
        }
        renderItem={({ item }) => {
          const stage = uploadStage(item);
          return (
            <Row
              title={item.name}
              detail={
                uploadStageLabel[stage] +
                (item.questionCount
                  ? " · " + item.questionCount + " questions"
                  : "")
              }
              onPress={() => void open(item)}
              right={
                opening === item.id ? (
                  <Muted>Opening…</Muted>
                ) : (
                  <ChevronRight
                    size={18}
                    color={
                      stage === "attention" ? palette.accent : palette.muted
                    }
                  />
                )
              }
              style={{ minHeight: 82 }}
            />
          );
        }}
        ListFooterComponent={
          items.length < total ? (
            <Button kind="text" onPress={() => setLimit((v) => v + 30)}>
              Show more
            </Button>
          ) : null
        }
      />
    </Screen>
  );
}
