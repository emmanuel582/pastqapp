import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  View,
  Pressable,
  PanResponder,
  AppState,
  useWindowDimensions,
} from "react-native";
import Svg, { Path, Pattern, Defs, Circle, Rect } from "react-native-svg";
import X from "lucide-react-native/icons/x";
import PenLine from "lucide-react-native/icons/pen-line";
import Eraser from "lucide-react-native/icons/eraser";
import Undo2 from "lucide-react-native/icons/undo-2";
import Trash2 from "lucide-react-native/icons/trash";
import { useApp } from "../state/AppContext";
import { Text, Muted, IconButton, Button, ErrorText } from "./ui";
import { fonts } from "../theme/tokens";
import { readWorkingPaper, saveWorkingPaper } from "../storage/working";
import {
  emptyWorkingPaper,
  workingPoint,
  appendWorkingPoint,
  type WorkingPaper,
  type WorkingStroke,
} from "../domain/working";
export default function DrawingBoard({
  attemptId,
  side = false,
  questionIndex,
  readOnly = false,
  flushRef,
  onClose,
}: {
  attemptId: string;
  side?: boolean;
  questionIndex: number;
  readOnly?: boolean;
  flushRef: MutableRefObject<(() => Promise<void>) | null>;
  onClose: () => void;
}) {
  const { palette, owner } = useApp();
  const window = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const [erase, setErase] = useState(false),
    [revision, setRevision] = useState(0),
    [height, setHeight] = useState(220),
    [layout, setLayout] = useState({ width: 300, height: 120 }),
    [loading, setLoading] = useState(true),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const paper = useRef<WorkingPaper>(emptyWorkingPaper()),
    active = useRef<WorkingStroke | null>(null),
    frame = useRef<number | undefined>(undefined),
    alive = useRef(true),
    edits = useRef(0),
    saved = useRef(0),
    pending = useRef<{ revision: number; promise: Promise<void> } | null>(null);
  const context = useRef({ erase, layout, loading, readOnly });
  context.current = { erase, layout, loading, readOnly };
  function redraw() {
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (alive.current) setRevision((v) => v + 1);
    });
  }
  function persist(): Promise<void> {
    const version = edits.current;
    if (readOnly || context.current.loading || version === saved.current)
      return Promise.resolve();
    if (pending.current?.revision === version) return pending.current.promise;
    if (alive.current) {
      setStatus("Saving…");
      setError("");
    }
    const promise = saveWorkingPaper(
      owner,
      attemptId,
      questionIndex,
      paper.current,
    )
      .then(() => {
        saved.current = Math.max(saved.current, version);
        if (alive.current && edits.current === version)
          setStatus("Saved on device");
      })
      .catch((e) => {
        if (alive.current) {
          setError(
            "Your working could not be saved. Free some storage, then retry.",
          );
          setStatus("");
        }
        throw e;
      })
      .finally(() => {
        if (pending.current?.revision === version) pending.current = null;
      });
    pending.current = { revision: version, promise };
    return promise;
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    alive.current = true;
    void readWorkingPaper(owner, attemptId, questionIndex)
      .then((value) => {
        if (alive.current) {
          paper.current = value;
          setLoading(false);
          setRevision((v) => v + 1);
        }
      })
      .catch(() => {
        if (alive.current)
          setError(
            "Your saved working could not open. Close this board and try again.",
          );
      });
    flushRef.current = () => persistRef.current();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void persistRef.current().catch(() => {});
    });
    return () => {
      alive.current = false;
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      void persistRef.current().catch(() => {});
      flushRef.current = null;
      sub.remove();
    };
  }, [owner, attemptId, questionIndex]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !context.current.loading && !context.current.readOnly,
        onMoveShouldSetPanResponder: () =>
          !context.current.loading && !context.current.readOnly,
        onPanResponderGrant: (event) => {
          if (paper.current.strokes.length >= 1000) {
            setError(
              "This working paper is full. Undo or clear some strokes to keep writing.",
            );
            return;
          }
          const c = context.current,
            stroke: WorkingStroke = {
              points: [
                workingPoint(
                  event.nativeEvent.locationX,
                  event.nativeEvent.locationY,
                  c.layout.width,
                  c.layout.height,
                ),
              ],
              erase: c.erase,
              size: c.erase ? 35 : 3,
            };
          active.current = stroke;
          paper.current = {
            version: 1,
            strokes: [...paper.current.strokes, stroke],
          };
          edits.current++;
          setStatus("");
          redraw();
        },
        onPanResponderMove: (event) => {
          if (!active.current) return;
          const c = context.current;
          appendWorkingPoint(
            active.current,
            workingPoint(
              event.nativeEvent.locationX,
              event.nativeEvent.locationY,
              c.layout.width,
              c.layout.height,
            ),
          );
          edits.current++;
          redraw();
        },
        onPanResponderRelease: (event) => {
          if (active.current) {
            const c = context.current;
            appendWorkingPoint(
              active.current,
              workingPoint(
                event.nativeEvent.locationX,
                event.nativeEvent.locationY,
                c.layout.width,
                c.layout.height,
              ),
              true,
            );
            edits.current++;
          }
          active.current = null;
          redraw();
          void persistRef.current().catch(() => {});
        },
        onPanResponderTerminate: () => {
          active.current = null;
          redraw();
          void persistRef.current().catch(() => {});
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  function replace(strokes: WorkingStroke[]) {
    active.current = null;
    paper.current = { version: 1, strokes };
    edits.current++;
    redraw();
    void persist().catch(() => {});
  }
  const controls = { height: 34, width: 34 };
  return (
    <View
      style={{
        height: side
          ? "100%"
          : Math.min(height, Math.max(170, window.height * 0.38)),
        width: side ? 320 : undefined,
        paddingHorizontal: 16,
        paddingBottom: Math.max(10, insets.bottom),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Resize working paper"
        onPress={() => setHeight((h) => (h === 220 ? 300 : 220))}
        style={{ height: 12, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            width: 40,
            height: 3,
            borderRadius: 2,
            backgroundColor: palette.muted,
          }}
        />
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 37,
        }}
      >
        <PenLine size={18} color={palette.muted} />
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, flex: 1 }}>
          {readOnly ? "Saved working" : "Working paper"}
        </Text>
        <IconButton
          label="Close working paper"
          onPress={() =>
            void persist()
              .then(onClose)
              .catch(() => {})
          }
          style={controls}
        >
          <X size={18} color={palette.muted} />
        </IconButton>
      </View>
      {!readOnly ? (
        <View style={{ flexDirection: "row", gap: 4, paddingVertical: 4 }}>
          <IconButton
            label="Pen"
            active={!erase}
            onPress={() => setErase(false)}
            disabled={loading}
            style={controls}
          >
            <PenLine size={18} color={palette.accent} />
          </IconButton>
          <IconButton
            label="Eraser"
            active={erase}
            onPress={() => setErase(true)}
            disabled={loading}
            style={controls}
          >
            <Eraser size={18} color={palette.muted} />
          </IconButton>
          <Muted style={{ flex: 1, fontSize: 10, alignSelf: "center" }}>
            {loading ? "Opening saved working…" : status}
          </Muted>
          <IconButton
            label="Undo stroke"
            disabled={loading || !paper.current.strokes.length}
            onPress={() => replace(paper.current.strokes.slice(0, -1))}
            style={controls}
          >
            <Undo2 size={18} color={palette.muted} />
          </IconButton>
          <IconButton
            label="Clear working paper"
            disabled={loading || !paper.current.strokes.length}
            onPress={() => replace([])}
            style={controls}
          >
            <Trash2 size={18} color={palette.muted} />
          </IconButton>
        </View>
      ) : null}
      {error ? (
        <View>
          <ErrorText>{error}</ErrorText>
          {!loading ? (
            <Button kind="text" onPress={() => void persist().catch(() => {})}>
              Retry save
            </Button>
          ) : null}
        </View>
      ) : null}
      <View
        {...responder.panHandlers}
        accessibilityLabel={
          readOnly
            ? "Saved reasoning for this question"
            : "Draw your working for this question"
        }
        onLayout={(e) => setLayout(e.nativeEvent.layout)}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: palette.line,
          borderRadius: 5,
          overflow: "hidden",
          backgroundColor: palette.panel,
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 800 700"
          preserveAspectRatio="none"
        >
          <Defs>
            <Pattern
              id="dots"
              width={64}
              height={64}
              patternUnits="userSpaceOnUse"
            >
              <Circle cx={32} cy={32} r={1.5} fill={palette.paperDot} />
            </Pattern>
          </Defs>
          <Rect width={800} height={700} fill="url(#dots)" />
          {paper.current.strokes.map((stroke, i) => (
            <Path
              key={i}
              d={
                stroke.points
                  .map((p, j) => (j ? "L" : "M") + p.x + " " + p.y)
                  .join(" ") + " l .1 0"
              }
              stroke={stroke.erase ? palette.panel : palette.ink}
              strokeWidth={stroke.size}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {readOnly && !loading && !paper.current.strokes.length ? (
          <Muted
            style={{
              position: "absolute",
              alignSelf: "center",
              top: 20,
              fontSize: 11,
            }}
          >
            No working saved for this question.
          </Muted>
        ) : null}
      </View>
    </View>
  );
}
