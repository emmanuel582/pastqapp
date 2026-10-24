import React from "react";
import { View, FlatList, Pressable } from "react-native";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import { useApp } from "../state/AppContext";
import { Text, Muted } from "./ui";
import { questionAnswered, questionOutcome } from "../domain/attempt";
import { isWrittenQuestion, theoryLabel } from "../domain/theory";
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
  const columns = indexes.some((i) => isWrittenQuestion(attempt.questions[i]))
    ? 4
    : 5;
  return (
    <View>
      <FlatList
        key={columns}
        data={indexes}
        numColumns={columns}
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
            <View style={{ width: `${100 / columns}%`, padding: 3 }}>
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
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    color,
                    fontSize: isWrittenQuestion(attempt.questions[item])
                      ? 11
                      : 14,
                  }}
                >
                  {isWrittenQuestion(attempt.questions[item])
                    ? theoryLabel(attempt.questions[item], item)
                    : item + 1}
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
