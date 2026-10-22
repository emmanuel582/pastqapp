import React, { memo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import BookOpen from "lucide-react-native/icons/book-open";
import { examArtwork } from "../domain/examArtwork";
import { useApp } from "../state/AppContext";
export default memo(function ExamArtwork({
  identity,
}: {
  identity?: Parameters<typeof examArtwork>[0];
}) {
  const { palette } = useApp();
  const type = examArtwork(identity);
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderWidth: 1,
        borderColor: palette.line,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {type ? (
        <Image
          source={
            type === "jamb"
              ? require("../../assets/exams/jamb.png")
              : require("../../assets/exams/waec.png")
          }
          contentFit="contain"
          style={{ width: 42, height: 42 }}
        />
      ) : (
        <BookOpen size={22} strokeWidth={1.5} color={palette.accent} />
      )}
    </View>
  );
});
