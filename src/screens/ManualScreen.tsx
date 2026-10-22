import X from "lucide-react-native/icons/x";
import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Screen,
  Text,
  Muted,
  Field,
  Button,
  ErrorText,
  IconButton,
} from "../components/ui";
import { useApp } from "../state/AppContext";
import { extractText } from "../services/uploads";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function ManualScreen({ navigation }: Props<"Manual">) {
  const { owner, palette } = useApp(),
    insets = useSafeAreaInsets();
  const [text, setText] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void records
      .read<{ name: string; text: string }>(owner, "manual", "draft")
      .then((value) => {
        if (active && value) {
          setName(value.name);
          setText(value.text);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [owner]);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void records
        .write(owner, "manual", "draft", { name, text })
        .catch(() => setError("Your draft could not be saved on this device."));
    }, 400);
    return () => clearTimeout(timer);
  }, [owner, name, text, loaded]);
  async function submit() {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const abort = new AbortController();
      transfer.current = abort;
      const id = await extractText(
        text,
        name.trim() || "Manual Entry",
        abort.signal,
      );
      abort.signal.throwIfAborted();
      await records.write(owner, "processing", "current", id);
      await records.remove(owner, "manual", "draft");
      navigation.replace("Processing", { sessionId: id });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not prepare your questions.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            paddingTop: 52,
            paddingHorizontal: 20,
            paddingBottom: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 17, fontFamily: fonts.serifMedium }}>
            Manual Entry
          </Text>
          <IconButton
            label="Close manual entry"
            disabled={busy}
            onPress={() => navigation.goBack()}
            style={{ width: 36, height: 36 }}
          >
            <X size={19} color={palette.muted} />
          </IconButton>
        </View>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 20,
            paddingBottom: Math.max(24, insets.bottom),
          }}
        >
          <Muted
            style={{ fontFamily: fonts.outfit, fontSize: 14, marginBottom: 8 }}
          >
            Material Name
          </Muted>
          <Field
            placeholder="e.g. Physics 2018 Past Q"
            value={name}
            onChangeText={setName}
            style={{ borderRadius: 12, marginBottom: 16 }}
          />
          <Muted
            style={{ fontFamily: fonts.outfit, fontSize: 14, marginBottom: 8 }}
          >
            Paste Questions Here
          </Muted>
          <TextInput
            multiline
            accessibilityLabel="Paste Questions Here"
            placeholder="Paste your raw text questions and options here..."
            placeholderTextColor={palette.faint}
            value={text}
            onChangeText={setText}
            style={{
              flex: 1,
              minHeight: 100,
              backgroundColor: palette.panel,
              borderWidth: 1,
              borderColor: palette.line,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontFamily: fonts.outfit,
              fontSize: 16,
              color: palette.ink,
              marginBottom: 24,
              textAlignVertical: "top",
            }}
          />
          <Button
            disabled={!text.trim() || busy}
            busy={busy}
            onPress={() => void submit()}
          >
            {busy ? "Preparing…" : "Prepare questions"}
          </Button>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
