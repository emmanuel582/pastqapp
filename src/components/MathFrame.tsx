import React, { useState } from "react";
import { WebView } from "react-native-webview";
export default function MathFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(48);
  return (
    <WebView
      source={{ html }}
      originWhitelist={["about:blank"]}
      onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
      javaScriptEnabled
      scrollEnabled={false}
      mixedContentMode="never"
      automaticallyAdjustContentInsets={false}
      textZoom={100}
      onMessage={(event) => {
        const n = Number(event.nativeEvent.data);
        if (Number.isFinite(n) && n > 0 && n < 50000) setHeight(n);
      }}
      style={{ height, minHeight: 1, backgroundColor: "transparent", flex: 0 }}
    />
  );
}
