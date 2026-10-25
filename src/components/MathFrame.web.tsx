import { useEffect, useRef, useState } from "react";
export default function MathFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(48),
    ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let observer: ResizeObserver | undefined;
    const frame = ref.current;
    function measure() {
      const doc = frame?.contentDocument;
      if (!doc) return;
      const update = () =>
        setHeight(Math.ceil(doc.body.getBoundingClientRect().height) || 48);
      observer = new ResizeObserver(update);
      observer.observe(doc.body);
      void doc.fonts.ready.then(update);
      update();
    }
    frame?.addEventListener("load", measure);
    return () => {
      observer?.disconnect();
      frame?.removeEventListener("load", measure);
    };
  }, [html]);
  return (
    <iframe
      ref={ref}
      title="Question content"
      srcDoc={html}
      sandbox="allow-same-origin"
      scrolling="no"
      style={{
        width: "100%",
        height,
        border: 0,
        display: "block",
        background: "transparent",
      }}
    />
  );
}
