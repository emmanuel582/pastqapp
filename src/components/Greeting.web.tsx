import React from "react";
import { greetingHtml } from "../data/greeting";
export default function Greeting({ height }: { height: number }) {
  return (
    <iframe
      title="Scholar greeting"
      srcDoc={greetingHtml}
      sandbox=""
      style={{
        border: 0,
        height,
        width: (height * 108) / 208,
        background: "transparent",
      }}
    />
  );
}
