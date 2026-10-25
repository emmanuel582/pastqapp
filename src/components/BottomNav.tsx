import { View, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import Home from "lucide-react-native/icons/house";
import Library from "lucide-react-native/icons/library";
import Compass from "lucide-react-native/icons/compass";
import User from "lucide-react-native/icons/user";
import Camera from "lucide-react-native/icons/camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/AppContext";
import { Text } from "./ui";
import { fonts } from "../theme/tokens";
export type MainTab = "home" | "library" | "discover" | "preferences";
const items = [
  { id: "home" as const, label: "Home", Icon: Home },
  { id: "library" as const, label: "Library", Icon: Library },
  { id: "discover" as const, label: "Discover", Icon: Compass },
  { id: "preferences" as const, label: "Preferences", Icon: User },
];
export default function BottomNav({
  tab,
  onTab,
  onUpload,
}: {
  tab: MainTab;
  onTab: (tab: MainTab) => void;
  onUpload: () => void;
}) {
  const { palette } = useApp(),
    insets = useSafeAreaInsets();
  return (
    <View
      style={{
        height: 96 + insets.bottom,
        backgroundColor: palette.bg,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 24,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: palette.panel,
        }}
      />
      <View
        style={{
          width: "100%",
          maxWidth: 480,
          height: 96,
          alignSelf: "center",
        }}
      >
        <Svg
          pointerEvents="none"
          width="100%"
          height={72}
          viewBox="0 0 375 72"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            top: 24,
            alignSelf: "center",
            backgroundColor: palette.bg,
          }}
        >
          <Path
            d="M0 0 L125 0 C140 0 145 38 187.5 38 C230 38 235 0 250 0 L375 0 L375 72 L0 72 Z"
            fill={palette.panel}
          />
        </Svg>
        <View
          style={{
            height: 72,
            marginTop: 24,
            maxWidth: 480,
            width: "100%",
            alignSelf: "center",
            paddingHorizontal: 8,
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          {items.map(({ id, label, Icon }, index) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: tab === id }}
              onPress={() => onTab(id)}
              style={{
                flex: 1,
                minHeight: 58,
                paddingBottom: 12,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                marginRight: index === 1 ? 48 : 0,
              }}
            >
              <Icon
                size={24}
                strokeWidth={tab === id ? 2.5 : 2}
                color={tab === id ? palette.accent : palette.muted}
              />
              <Text
                style={{
                  fontSize: 10,
                  lineHeight: 15,
                  fontFamily: fonts.semibold,
                  color: tab === id ? palette.accent : palette.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add material"
          onPress={onUpload}
          style={({ pressed }) => ({
            position: "absolute",
            zIndex: 1,
            top: -4,
            left: "50%",
            marginLeft: -26,
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.button,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            boxShadow: "0 8px 16px #00000030",
          })}
        >
          <Camera size={24} color={palette.onButton} />
        </Pressable>
      </View>
    </View>
  );
}
