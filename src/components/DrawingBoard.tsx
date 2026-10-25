import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { View, PanResponder, AppState, Animated, Platform } from "react-native";
import Svg, { Path, Pattern, Defs, Circle, Rect } from "react-native-svg";
import X from "lucide-react-native/icons/x";
import PenLine from "lucide-react-native/icons/pen-line";
import Hand from "lucide-react-native/icons/hand";
import Eraser from "lucide-react-native/icons/eraser";
import Undo2 from "lucide-react-native/icons/undo-2";
import Maximize2 from "lucide-react-native/icons/maximize-2";
import Minimize2 from "lucide-react-native/icons/minimize-2";
import {
  fitWorkingBoard,
  resizeWorkingBoard,
  type WorkingBoardSize,
} from "../domain/workingBoard";
import Trash2 from "lucide-react-native/icons/trash";
import { useApp } from "../state/AppContext";
import { Text, Muted, IconButton, Button, ErrorText } from "./ui";
import { fonts } from "../theme/tokens";
import { readWorkingPaper, saveWorkingPaper } from "../storage/working";
import {
  emptyWorkingPaper,
  canvasWorkingPoint,
  workingViewportHeight,
  projectWorkingPaper,
  workingPan,
  MAX_WORKING_HEIGHT,
  appendWorkingPoint,
  type WorkingPaper,
  type WorkingStroke,
} from "../domain/working";
export default function DrawingBoard({
  attemptId,
  side = false,
  expanded,
  onToggleExpanded,
  savedSize,
  maxHeight,
  maxWidth,
  onWidthChange,
  questionIndex,
  readOnly = false,
  disabled = false,
  flushRef,
  onClose,
}: {
  attemptId: string;
  side?: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  savedSize: MutableRefObject<WorkingBoardSize>;
  maxHeight: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
  questionIndex: number;
  readOnly?: boolean;
  disabled?: boolean;
  flushRef: MutableRefObject<(() => Promise<void>) | null>;
  onClose: () => void;
}) {
  const { palette, owner } = useApp();
  const insets = useSafeAreaInsets();
  const [tool, setTool] = useState<"pen" | "erase" | "move">(
      readOnly ? "move" : "pen",
    ),
    [, setRevision] = useState(0),
    [displayedSize, setDisplayedSize] = useState(() =>
      fitWorkingBoard(savedSize.current, {
        width: maxWidth,
        height: maxHeight,
      }),
    ),
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
  const layout = useRef({ width: 0, height: 0 });
  const viewY = useRef(0),
    panStart = useRef(0),
    movingPaper = useRef(false);
  function preparePaper() {
    if (layout.current.width > 0 && layout.current.height > 0)
      paper.current = projectWorkingPaper(
        paper.current,
        layout.current.width,
        layout.current.height,
      );
  }
  function pointAt(x: number, y: number) {
    const point = canvasWorkingPoint(x, y, layout.current.width, viewY.current);
    if (paper.current.version === 2) {
      paper.current.height = Math.max(paper.current.height, point.y);
      paper.current.viewY = viewY.current;
    }
    return point;
  }
  const context = useRef({
    tool,
    layout: layout.current,
    loading,
    readOnly: readOnly || disabled,
  });
  context.current = {
    tool,
    layout: layout.current,
    loading,
    readOnly: readOnly || disabled,
  };
  const size = useRef(
    fitWorkingBoard(savedSize.current, { width: maxWidth, height: maxHeight }),
  );
  const animatedHeight = useRef(
    new Animated.Value(size.current.height),
  ).current;
  const resizeContext = useRef({
    side,
    expanded,
    maxWidth,
    maxHeight,
    onWidthChange,
  });
  resizeContext.current = {
    side,
    expanded,
    maxWidth,
    maxHeight,
    onWidthChange,
  };
  function applySize(next: WorkingBoardSize, remember = true) {
    size.current = next;
    animatedHeight.setValue(next.height);
    if (remember)
      savedSize.current = {
        ...savedSize.current,
        ...(resizeContext.current.side
          ? { width: next.width }
          : { height: next.height }),
      };
    if (resizeContext.current.side)
      resizeContext.current.onWidthChange(next.width);
  }
  useEffect(() => {
    applySize(
      fitWorkingBoard(savedSize.current, {
        width: maxWidth,
        height: maxHeight,
      }),
      false,
    );
    setDisplayedSize({ ...size.current });
  }, [maxWidth, maxHeight, side]);
  const lastDrag = useRef(0),
    resized = useRef(false);
  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !resizeContext.current.expanded,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !resizeContext.current.expanded &&
          Math.abs(resizeContext.current.side ? gesture.dx : gesture.dy) > 3,
        onPanResponderGrant: (event) => {
          if (Platform.OS === "web") event.preventDefault();
          preparePaper();
          lastDrag.current = 0;
          resized.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          const current = resizeContext.current;
          const travel = current.side ? gesture.dx : gesture.dy;
          if (Math.abs(travel) > 3) resized.current = true;
          applySize(
            resizeWorkingBoard(
              size.current,
              travel - lastDrag.current,
              current.side,
              { width: current.maxWidth, height: current.maxHeight },
            ),
          );
          lastDrag.current = travel;
        },
        onPanResponderRelease: () => {
          if (!resized.current) toggleSize();
          setDisplayedSize({ ...size.current });
        },
        onPanResponderTerminate: () => setDisplayedSize({ ...size.current }),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [],
  );
  function toggleSize() {
    const current = resizeContext.current;
    const max = current.side ? current.maxWidth : current.maxHeight;
    const value = current.side ? size.current.width : size.current.height;
    adjustSize(
      value < max * 0.8
        ? value - max
        : value - Math.min(current.side ? 320 : 260, max),
    );
  }
  function adjustSize(delta: number) {
    preparePaper();
    const current = resizeContext.current;
    applySize(
      resizeWorkingBoard(size.current, delta, current.side, {
        width: current.maxWidth,
        height: current.maxHeight,
      }),
    );
    setDisplayedSize({ ...size.current });
  }
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
        if (alive.current && edits.current === version) setStatus("Saved");
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
          viewY.current = value.version === 2 ? value.viewY : 0;
          preparePaper();
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
          !context.current.loading &&
          (!context.current.readOnly || context.current.tool === "move"),
        onMoveShouldSetPanResponder: () =>
          !context.current.loading &&
          (!context.current.readOnly || context.current.tool === "move"),
        onPanResponderGrant: (event) => {
          preparePaper();
          movingPaper.current = context.current.tool === "move";
          panStart.current = 0;
          if (movingPaper.current) return;
          if (paper.current.strokes.length >= 1000) {
            setError(
              "This working paper is full. Undo or clear some strokes to keep writing.",
            );
            return;
          }
          const erase = context.current.tool === "erase";
          const stroke: WorkingStroke = {
            points: [
              pointAt(event.nativeEvent.locationX, event.nativeEvent.locationY),
            ],
            erase,
            size: erase ? 35 : 3,
          };
          active.current = stroke;
          paper.current = {
            ...paper.current,
            strokes: [...paper.current.strokes, stroke],
          };
          edits.current++;
          setStatus("");
          redraw();
        },
        onPanResponderMove: (event, gesture) => {
          if (movingPaper.current) {
            viewY.current = workingPan(
              viewY.current,
              gesture.dy - panStart.current,
              layout.current.width,
              layout.current.height,
            );
            panStart.current = gesture.dy;
            if (!context.current.readOnly && paper.current.version === 2) {
              paper.current.viewY = viewY.current;
              paper.current.height = Math.max(
                paper.current.height,
                Math.min(
                  MAX_WORKING_HEIGHT,
                  viewY.current +
                    workingViewportHeight(
                      layout.current.width,
                      layout.current.height,
                    ),
                ),
              );
              edits.current++;
            }
            redraw();
            return;
          }
          if (!active.current || context.current.readOnly) return;
          appendWorkingPoint(
            active.current,
            pointAt(event.nativeEvent.locationX, event.nativeEvent.locationY),
          );
          edits.current++;
          redraw();
        },
        onPanResponderRelease: (event) => {
          if (active.current && !context.current.readOnly) {
            appendWorkingPoint(
              active.current,
              pointAt(event.nativeEvent.locationX, event.nativeEvent.locationY),
              true,
            );
            edits.current++;
          }
          active.current = null;
          movingPaper.current = false;
          redraw();
          void persistRef.current().catch(() => {});
        },
        onPanResponderTerminate: () => {
          active.current = null;
          movingPaper.current = false;
          redraw();
          void persistRef.current().catch(() => {});
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  function replace(strokes: WorkingStroke[]) {
    active.current = null;
    paper.current = { ...paper.current, strokes };
    edits.current++;
    redraw();
    void persist().catch(() => {});
  }
  const controls = { height: 44, width: 44 };
  return (
    <Animated.View
      style={{
        height: side || expanded ? "100%" : animatedHeight,
        width: side || expanded ? "100%" : undefined,
        paddingHorizontal: side ? 24 : 12,
        paddingTop: expanded ? 8 : 0,
        paddingBottom: expanded ? 10 : Math.max(10, insets.bottom),
        backgroundColor: palette.bg,
      }}
    >
      {!expanded ? (
        <View
          {...resizeResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize working paper"
          accessibilityHint={
            side ? "Drag left or right to resize" : "Drag up or down to resize"
          }
          accessibilityValue={{
            min: Math.min(side ? 220 : 156, side ? maxWidth : maxHeight),
            max: side ? maxWidth : maxHeight,
            now: Math.round(side ? displayedSize.width : displayedSize.height),
          }}
          {...(Platform.OS === "web"
            ? {
                "aria-valuemin": Math.min(
                  side ? 220 : 156,
                  side ? maxWidth : maxHeight,
                ),
                "aria-valuemax": side ? maxWidth : maxHeight,
                "aria-valuenow": Math.round(
                  side ? displayedSize.width : displayedSize.height,
                ),
              }
            : {})}
          accessibilityActions={[
            { name: "increment", label: "Expand working paper" },
            { name: "decrement", label: "Reduce working paper" },
          ]}
          onAccessibilityAction={(event) =>
            adjustSize(event.nativeEvent.actionName === "increment" ? -48 : 48)
          }
          hitSlop={side ? 12 : 8}
          style={{
            ...(side
              ? {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 20,
                  zIndex: 2,
                }
              : { height: 28 }),
            alignItems: "center",
            justifyContent: "center",
            ...(Platform.OS === "web"
              ? ({
                  touchAction: "none",
                  userSelect: "none",
                  cursor: side ? "ew-resize" : "ns-resize",
                } as any)
              : {}),
          }}
        >
          <View
            style={{
              width: side ? 3 : 44,
              height: side ? 44 : 3,
              borderRadius: 2,
              backgroundColor: palette.muted,
            }}
          />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 44,
        }}
      >
        <PenLine size={18} color={palette.muted} />
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, flex: 1 }}>
          {readOnly ? "Saved working" : "Working paper"}
        </Text>
        <IconButton
          label={
            expanded ? "Restore working paper size" : "Expand working paper"
          }
          onPress={() => {
            preparePaper();
            onToggleExpanded();
          }}
          style={controls}
        >
          {expanded ? (
            <Minimize2 size={19} color={palette.accent} />
          ) : (
            <Maximize2 size={19} color={palette.accent} />
          )}
        </IconButton>
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
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
            paddingVertical: 4,
          }}
        >
          <IconButton
            label="Pen"
            active={tool === "pen"}
            onPress={() => setTool("pen")}
            disabled={loading || disabled}
            style={controls}
          >
            <PenLine size={18} color={palette.accent} />
          </IconButton>
          <IconButton
            label="Eraser"
            active={tool === "erase"}
            onPress={() => setTool("erase")}
            disabled={loading || disabled}
            style={controls}
          >
            <Eraser size={18} color={palette.muted} />
          </IconButton>
          <IconButton
            label="Move paper"
            active={tool === "move"}
            onPress={() => setTool("move")}
            disabled={loading || disabled}
            style={controls}
          >
            <Hand
              size={18}
              color={tool === "move" ? palette.accent : palette.muted}
            />
          </IconButton>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 10,
              color: palette.muted,
              alignSelf: "center",
            }}
          >
            {loading ? "Opening…" : status}
          </Text>
          <IconButton
            label="Undo stroke"
            disabled={loading || disabled || !paper.current.strokes.length}
            onPress={() => replace(paper.current.strokes.slice(0, -1))}
            style={controls}
          >
            <Undo2 size={18} color={palette.muted} />
          </IconButton>
          <IconButton
            label="Clear working paper"
            disabled={loading || disabled || !paper.current.strokes.length}
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
            : tool === "move"
              ? "Move working paper"
              : "Draw your working for this question"
        }
        onLayout={(event) => {
          layout.current = event.nativeEvent.layout;
          context.current.layout = layout.current;
          preparePaper();
          viewY.current = Math.min(
            viewY.current,
            MAX_WORKING_HEIGHT -
              workingViewportHeight(
                layout.current.width,
                layout.current.height,
              ),
          );
          redraw();
        }}
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
          viewBox={`0 ${viewY.current} 800 ${workingViewportHeight(layout.current.width, layout.current.height)}`}
          preserveAspectRatio="none"
          pointerEvents="none"
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
          <Rect width={800} height={MAX_WORKING_HEIGHT} fill="url(#dots)" />
          <SavedInk
            strokes={paper.current.strokes}
            active={active.current}
            ink={palette.ink}
            background={palette.panel}
          />
          {active.current ? (
            <InkStroke
              stroke={{ ...active.current }}
              ink={palette.ink}
              background={palette.panel}
            />
          ) : null}
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
    </Animated.View>
  );
}

// Completed paths stay cached while resizing the board or adding points to the current stroke.
const InkStroke = memo(function InkStroke({
  stroke,
  ink,
  background,
}: {
  stroke: WorkingStroke;
  ink: string;
  background: string;
}) {
  return (
    <Path
      d={
        stroke.points
          .map((point, index) => (index ? "L" : "M") + point.x + " " + point.y)
          .join(" ") + " l .1 0"
      }
      stroke={stroke.erase ? background : ink}
      strokeWidth={stroke.size}
      transform={
        stroke.legacyScaleY ? `scale(1 ${stroke.legacyScaleY})` : undefined
      }
      vectorEffect={stroke.legacyScaleY ? undefined : "non-scaling-stroke"}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});
const SavedInk = memo(function SavedInk({
  strokes,
  active,
  ink,
  background,
}: {
  strokes: WorkingStroke[];
  active: WorkingStroke | null;
  ink: string;
  background: string;
}) {
  return (
    <>
      {strokes.map((stroke, index) =>
        stroke === active ? null : (
          <InkStroke
            key={index}
            stroke={stroke}
            ink={ink}
            background={background}
          />
        ),
      )}
    </>
  );
});
