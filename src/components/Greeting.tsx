import React, { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { greetingHtml } from "../data/greeting";
import { useReducedMotion } from "../hooks/useReducedMotion";
export default function Greeting({ height }: { height: number }) {
  const reduced = useReducedMotion();
  const html = useMemo(
    () =>
      reduced
        ? greetingHtml
            .replace(/<animate\b[^>]*\/>/g, "")
            .replace("animation:blink", "animation:none;--unused:blink")
        : greetingHtml,
    [reduced],
  );
  return (
    <View style={{ height, width: (height * 108) / 208 }}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        originWhitelist={["about:blank", "data:*"]}
        javaScriptEnabled={false}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        onShouldStartLoadWithRequest={(r) =>
          r.url === "about:blank" || r.url.startsWith("data:")
        }
        accessible={false}
      />
    </View>
  );
}
