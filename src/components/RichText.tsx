import { memo, useMemo } from "react";
import { Text as NativeText, View } from "react-native";
import { useApp } from "../state/AppContext";
import { fonts } from "../theme/tokens";
import type { Asset } from "../domain/types";
import { contentHtml, richDocument } from "../services/richContent";
import MathFrame from "./MathFrame";
export default memo(function RichText({
  text,
  html,
  assets,
  size = 14,
  serif = false,
}: {
  text: string;
  html?: string;
  assets?: Record<string, Asset>;
  size?: number;
  serif?: boolean;
}) {
  const { palette } = useApp();
  const complex = !!html || /\$|\\\[|\\\(/.test(text);
  const document = useMemo(
    () =>
      complex
        ? richDocument(contentHtml(text, html, assets), palette, size, serif)
        : null,
    [text, html, assets, palette, size, serif],
  );
  return document ? (
    <View style={{ width: "100%" }}>
      <MathFrame html={document} />
    </View>
  ) : (
    <NativeText
      selectable
      style={{
        fontFamily: serif ? fonts.serif : fonts.body,
        fontSize: size,
        lineHeight: size * 1.65,
        letterSpacing: serif ? -size * 0.02 : 0,
        color: palette.ink,
      }}
    >
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <NativeText key={i} style={{ fontStyle: "italic" }}>
            {part.slice(1, -1)}
          </NativeText>
        ) : (
          part
        ),
      )}
    </NativeText>
  );
});
