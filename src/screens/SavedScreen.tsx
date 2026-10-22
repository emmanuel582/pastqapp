import { matchesSavedQuestion } from "../domain/search";
import React, { useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import BookmarkIcon from "lucide-react-native/icons/bookmark";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Trash2 from "lucide-react-native/icons/trash";
import PenLine from "lucide-react-native/icons/pen-line";
import * as Crypto from "expo-crypto";
import { useApp } from "../state/AppContext";
import {
  Screen,
  Header,
  Text,
  Muted,
  Button,
  SearchField,
  Checkbox,
  IconButton,
  Empty,
  Field,
  ErrorText,
  Dialog,
} from "../components/ui";
import RichText from "../components/RichText";
import QuestionMedia from "../components/QuestionMedia";
import * as records from "../storage/records";
import { createAttempt } from "../domain/attempt";
import { saveAttempt } from "../storage/practice";
import { fonts } from "../theme/tokens";
import type { Bookmark } from "../domain/types";
import type { Props } from "../navigation/types";
export default function SavedScreen({ navigation }: Props<"Saved">) {
  const { owner, palette, bookmarks, refreshPractice } = useApp();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [noteKey, setNoteKey] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [opened, setOpened] = useState<Bookmark | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = bookmarks.filter((row) =>
    matchesSavedQuestion(row.question, row.note, query),
  );
  async function practice() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const chosen = bookmarks.filter((b) => selected.includes(b.id)),
        questions = chosen.map((b) => ({
          ...b.question,
          sourceBundleId: b.bundleId,
        })),
        assets = Object.assign({}, ...chosen.map((b) => b.assets || {}));
      const bundle = {
        id: "saved-revision",
        title: "Saved questions",
        questions,
        assets,
      };
      const attempt = createAttempt(
        bundle,
        questions,
        1200,
        "practice",
        owner,
        Crypto.randomUUID(),
      );
      await saveAttempt(attempt, true);
      await refreshPractice();
      navigation.navigate("Exam", { attemptId: attempt.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start practice.");
    } finally {
      setBusy(false);
    }
  }
  async function run(work: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await work();
      await refreshPractice();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this change.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title="Saved questions" onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
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
            {
              <>
                {bookmarks.length ? (
                  <>
                    <SearchField
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Subject, year, question or note"
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 8,
                        paddingBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <Checkbox
                          label="Select matching questions"
                          checked={
                            rows.length > 0 &&
                            rows.every((b) => selected.includes(b.id))
                          }
                          onPress={() =>
                            setSelected((old) =>
                              rows.every((b) => old.includes(b.id))
                                ? old.filter(
                                    (id) => !rows.some((b) => b.id === id),
                                  )
                                : [
                                    ...new Set([
                                      ...old,
                                      ...rows.map((b) => b.id),
                                    ]),
                                  ],
                            )
                          }
                        />
                        <Muted>Select matching</Muted>
                      </View>
                      <Button
                        kind="secondary"
                        arrow
                        disabled={!selected.length || busy}
                        onPress={() => void practice()}
                      >
                        Practise{selected.length ? " · " + selected.length : ""}
                      </Button>
                    </View>
                  </>
                ) : null}
                {error ? <ErrorText>{error}</ErrorText> : null}
              </>
            }
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <View
              style={{
                flexDirection: "row",
                gap: 4,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
                alignItems: "center",
              }}
            >
              <Checkbox
                label={
                  "Select saved " +
                  item.question.subject +
                  " question " +
                  (index + 1)
                }
                checked={selected.includes(item.id)}
                onPress={() =>
                  setSelected((old) =>
                    old.includes(item.id)
                      ? old.filter((id) => id !== item.id)
                      : [...old, item.id],
                  )
                }
              />
              <Pressable
                onPress={() => setOpened(item)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: 18,
                  paddingHorizontal: 8,
                  gap: 7,
                }}
              >
                <Muted>
                  {item.question.subject}
                  {item.question.year ? " · " + item.question.year : ""}
                </Muted>
                <Text numberOfLines={2} style={{ fontFamily: fonts.medium }}>
                  {item.question.question
                    .replace(/\[Illustration\]/gi, "")
                    .trim() || "View diagram"}
                </Text>
              </Pressable>
              <IconButton
                label={
                  "Edit note for " +
                  item.question.subject +
                  " question " +
                  (index + 1)
                }
                onPress={() => {
                  setNoteKey(noteKey === item.id ? null : item.id);
                  setNote(item.note);
                }}
                style={{ width: 36 }}
              >
                <PenLine size={16} color={palette.muted} />
              </IconButton>
              <IconButton
                label={"Remove saved " + item.question.subject + " question"}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await records.remove(owner, "bookmark", item.id);
                    setSelected((old) => old.filter((id) => id !== item.id));
                  })
                }
                style={{ width: 36 }}
              >
                <Trash2 size={17} color={palette.muted} />
              </IconButton>
            </View>
            {noteKey === item.id ? (
              <View style={{ paddingTop: 12, paddingBottom: 16, gap: 10 }}>
                <Field
                  label="Your note"
                  value={note}
                  onChangeText={setNote}
                  maxLength={10000}
                  multiline
                  style={{ height: 120, textAlignVertical: "top" }}
                />
                <Button
                  kind="secondary"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await records.write(owner, "bookmark", item.id, {
                        ...item,
                        note,
                      });
                      setNoteKey(null);
                    })
                  }
                >
                  Save note
                </Button>
              </View>
            ) : item.note ? (
              <Muted style={{ paddingBottom: 14 }}>{item.note}</Muted>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View>
            {
              <Empty
                title={
                  bookmarks.length
                    ? "No matching questions."
                    : "Save a question to revisit it."
                }
                icon={
                  <BookmarkIcon
                    size={30}
                    strokeWidth={1.3}
                    color={palette.muted}
                  />
                }
              />
            }
          </View>
        }
      />
      {opened ? (
        <Dialog title={opened.question.subject} onClose={() => setOpened(null)}>
          <QuestionMedia
            passage={opened.question.passage}
            figures={opened.question.figures}
            assets={opened.assets}
          />
          <RichText
            text={opened.question.question}
            html={opened.question.questionHtml}
            assets={opened.assets}
            serif
            size={18}
          />
          <View style={{ marginTop: 20 }}>
            <RichText
              text={
                opened.question.explanation || opened.question.answerText || ""
              }
              html={
                opened.question.explanationHtml || opened.question.answerHtml
              }
              assets={opened.assets}
              size={13}
            />
          </View>
          <Button
            onPress={() => {
              setSelected([opened.id]);
              setOpened(null);
            }}
            style={{ marginTop: 20 }}
          >
            Select for practice
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
