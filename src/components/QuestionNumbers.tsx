import React from "react";
import { View, FlatList, Pressable } from "react-native";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import { useApp } from "../state/AppContext";
import { Text, Muted } from "./ui";
import { questionAnswered, questionOutcome } from "../domain/attempt";
import { questionNumberLabel } from "../domain/review";
import { fonts } from "../theme/tokens";
import type { Attempt } from "../domain/types";
export default function QuestionNumbers({
  attempt,
  indexes,
  review = false,
  current,
  onSelect,
}: {
  attempt: Attempt;
  indexes: number[];
  review?: boolean;
  current?: number;
  onSelect: (index: number) => void;
}) {
  const { palette } = useApp();
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 14,
          marginVertical: 12,
        }}
      >
        {review ? (
          <>
            <Text style={{ fontSize: 12, color: palette.correct }}>
              ✓ Correct
            </Text>
            <Text style={{ fontSize: 12, color: palette.incorrect }}>
              × Wrong
            </Text>
            <Muted>— Unanswered</Muted>
            {attempt.questions.some(
              (_, i) => questionOutcome(attempt, i) === "reviewed",
            ) ? (
              <Muted>Not auto-marked: review the answer</Muted>
            ) : null}
          </>
        ) : (
          <Muted>Filled: answered · Empty: unanswered</Muted>
        )}
      </View>
      <FlatList
        data={indexes}
        numColumns={5}
        keyExtractor={(i) => String(i)}
        style={{ maxHeight: 320 }}
        initialNumToRender={30}
        windowSize={5}
        ListEmptyComponent={<Muted>No questions in this group.</Muted>}
        renderItem={({ item }) => {
          const outcome = questionOutcome(attempt, item),
            answered = questionAnswered(attempt, item),
            correct = review && outcome === "correct",
            wrong = review && outcome === "incorrect";
          const color = correct
            ? palette.correct
            : wrong
              ? palette.incorrect
              : !review && answered
                ? palette.onDone
                : palette.ink;
          return (
            <View style={{ width: "20%", padding: 3 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={questionNumberLabel(attempt, item, review)}
                accessibilityState={{ selected: current === item }}
                onPress={() => onSelect(item)}
                style={({ pressed }) => ({
                  height: 48,
                  borderRadius: 7,
                  borderWidth: current === item ? 2 : 1,
                  borderColor:
                    correct || wrong
                      ? color
                      : current === item
                        ? palette.accent
                        : palette.line,
                  backgroundColor: correct
                    ? palette.correctWash
                    : wrong
                      ? palette.incorrectWash
                      : answered
                        ? !review
                          ? palette.done
                          : palette.control
                        : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <Text style={{ fontFamily: fonts.mono, color, fontSize: 14 }}>
                  {item + 1}
                </Text>
                {correct || wrong ? (
                  <View style={{ position: "absolute", right: 3, top: 3 }}>
                    {correct ? (
                      <Check size={10} color={color} />
                    ) : (
                      <X size={10} color={color} />
                    )}
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
