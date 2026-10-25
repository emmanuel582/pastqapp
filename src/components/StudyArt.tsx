import Svg, { Path, Circle, G } from "react-native-svg";
import { useApp } from "../state/AppContext";
export function StudyArt({ type = "institution" }: { type?: string }) {
  const { palette } = useApp();
  return (
    <Svg width={74} height={50} viewBox="0 0 180 120" fill="none">
      {type === "institution" ? (
        <>
          <Path
            d="M20 101H159M31 96V45L89 18l58 27v51M30 45h118M37 91h104M46 53v30m22-30v30m22-30v30m22-30v30m22-30v30"
            stroke={palette.muted}
            strokeWidth="2"
          />
          <Path d="M59 42h61L89 27z" fill={palette.muted} opacity=".1" />
          <Circle cx="89" cy="35" r="3" fill={palette.accent} />
          <Path
            d="M25 108h130M43 88h13m9 0h13m9 0h13m9 0h13m9 0h13"
            stroke={palette.muted}
            opacity=".3"
          />
        </>
      ) : type === "exam_board" ? (
        <>
          <G transform="rotate(-10 85 60)">
            <Path d="M48 17h72v90H48z" fill={palette.muted} opacity=".06" />
            <Path
              d="M48 17h72v90H48zM62 34h44M62 42h27M76 62h30M76 78h30M76 94h19"
              stroke={palette.muted}
              strokeWidth="1.5"
            />
            <Path
              d="m58 60 4 4 7-9m-11 22 4 4 7-9m-11 22 4 4 7-9"
              stroke={palette.accent}
              strokeWidth="2"
            />
          </G>
          <Path
            d="m126 86 15-57 6 2-15 57-6 7z"
            stroke={palette.muted}
            strokeWidth="1.5"
          />
        </>
      ) : (
        <>
          <Path
            d="M43 81V48c16-8 30-8 47 0 17-8 31-8 47 0v33c-17-7-31-7-47 0-17-7-31-7-47 0zM90 48v33M43 88h94"
            stroke={palette.muted}
            strokeWidth="1.5"
          />
          <Circle
            cx="90"
            cy="26"
            r="13"
            stroke={palette.accent}
            strokeWidth="1.5"
          />
          <Path
            d="m84 26 4 4 9-10M74 15l-7-6m39 6 7-6M90 7V1"
            stroke={palette.accent}
            strokeWidth="1.5"
          />
          <Path
            d="M56 56h23m-23 8h23m23-8h23m-23 8h23"
            stroke={palette.muted}
            opacity=".3"
          />
        </>
      )}
    </Svg>
  );
}
