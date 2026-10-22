import React, { useEffect, useRef, type ReactNode } from "react";
import {
  View,
  Text as NativeText,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  type TextProps,
  type TextStyle,
  type ViewStyle,
  type StyleProp,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useApp } from "../state/AppContext";
import { fonts, motion } from "../theme/tokens";
export function Text({ style, ...props }: TextProps) {
  const { palette } = useApp();
  return (
    <NativeText
      {...props}
      style={[
        {
          fontFamily: fonts.body,
          fontSize: 14,
          lineHeight: 21,
          color: palette.ink,
        },
        style,
      ]}
    />
  );
}
export function Title({
  children,
  size = 32,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          fontFamily: fonts.display,
          fontSize: size,
          lineHeight: size * 1.2,
          letterSpacing: -size * 0.035,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Muted({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { palette } = useApp();
  return (
    <Text
      style={[{ color: palette.muted, fontSize: 12, lineHeight: 18 }, style]}
    >
      {children}
    </Text>
  );
}
export function Wordmark({ size = 23 }: { size?: number }) {
  const { palette } = useApp();
  return (
    <Text
      accessibilityLabel="PastQ"
      style={{
        fontFamily: fonts.bold,
        fontSize: size,
        lineHeight: size * 1.15,
        letterSpacing: -size * 0.056,
      }}
    >
      past
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: size,
          lineHeight: size * 1.15,
          color: palette.accent,
          letterSpacing: -size * 0.056,
        }}
      >
        q
      </Text>
    </Text>
  );
}
export function Button({
  children,
  onPress,
  kind = "primary",
  disabled = false,
  busy = false,
  style,
  buttonStyle,
  arrow = false,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  kind?: "primary" | "secondary" | "text";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
  arrow?: boolean;
  label?: string;
}) {
  const { palette } = useApp();
  const y = useRef(new Animated.Value(0)).current;
  const color =
    kind === "primary"
      ? palette.onButton
      : kind === "text"
        ? palette.accent
        : palette.ink;
  const animate = (value: number) =>
    Animated.timing(y, {
      toValue: value,
      duration: motion.press,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  return (
    <Animated.View
      style={[
        { transform: [{ translateY: y }], opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onPress}
        onPressIn={() => animate(1)}
        onPressOut={() => animate(0)}
        style={[
          styles.button,
          kind === "primary"
            ? {
                backgroundColor: palette.button,
                borderColor: palette.button,
                borderBottomColor: palette.buttonShadow,
                borderBottomWidth: 3,
              }
            : kind === "secondary"
              ? { backgroundColor: palette.wash, borderColor: palette.line }
              : {
                  backgroundColor: "transparent",
                  borderColor: "transparent",
                  paddingHorizontal: 0,
                  minHeight: 44,
                },
          buttonStyle,
        ]}
      >
        {busy ? <ActivityIndicator color={color} size="small" /> : null}
        {typeof children === "string" ? (
          <Text style={{ fontFamily: fonts.bold, color, fontSize: 13 }}>
            {children}
          </Text>
        ) : (
          children
        )}
        {arrow && !busy ? <ArrowRight size={17} color={color} /> : null}
      </Pressable>
    </Animated.View>
  );
}
export function IconButton({
  children,
  onPress,
  label,
  active = false,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [
        {
          width: 42,
          height: 42,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 5,
          borderWidth: 1,
          borderColor: active ? palette.accent : "transparent",
          backgroundColor: active
            ? palette.accentWash
            : pressed
              ? palette.wash
              : "transparent",
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
export function Header({
  title,
  onBack,
  right,
  brand = true,
  style,
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  brand?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useApp();
  return (
    <View style={[styles.header, { borderBottomColor: palette.line }, style]}>
      {onBack ? (
        <IconButton onPress={onBack} label="Go back">
          <ArrowLeft size={20} color={palette.muted} />
        </IconButton>
      ) : null}
      {title ? (
        <Title size={19} style={{ flex: 1 }}>
          {title}
        </Title>
      ) : brand ? (
        <View style={{ flex: 1 }}>
          <Wordmark />
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}
export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: palette.bg, paddingTop: insets.top },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Content({
  children,
  style,
  center = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  center?: boolean;
}) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          padding: 22,
          paddingTop: 28,
          paddingBottom: 40,
          width: "100%",
          maxWidth: 744,
          alignSelf: "center",
        },
        center && { flexGrow: 1, justifyContent: "center" },
        style,
      ]}
    >
      {children}
    </ScrollView>
  );
}
export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { palette } = useApp();
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={palette.faint}
        accessibilityLabel={label || props.placeholder}
        {...props}
        style={[
          styles.input,
          {
            color: palette.ink,
            backgroundColor: palette.panel,
            borderColor: error ? palette.accent : palette.line,
          },
          style,
        ]}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}
export function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useApp();
  return (
    <View
      style={[
        styles.search,
        { borderColor: palette.line, backgroundColor: palette.wash },
        style,
      ]}
    >
      <Search size={18} color={palette.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        style={{
          fontFamily: fonts.body,
          fontSize: 16,
          color: palette.ink,
          flex: 1,
          padding: 0,
          height: 46,
          minWidth: 0,
        }}
      />
    </View>
  );
}
export function ErrorText({ children }: { children: ReactNode }) {
  const { palette } = useApp();
  return (
    <Text
      accessibilityRole="alert"
      style={{
        fontSize: 12,
        lineHeight: 19,
        color: palette.ink,
        borderLeftWidth: 2,
        borderLeftColor: palette.accent,
        backgroundColor: palette.accentWash,
        padding: 12,
        borderRadius: 6,
        marginVertical: 12,
      }}
    >
      {children}
    </Text>
  );
}
export function Line() {
  const { palette } = useApp();
  return <View style={{ height: 1, backgroundColor: palette.line }} />;
}
export function Row({
  title,
  detail,
  icon,
  onPress,
  right,
  style,
}: {
  title: string;
  detail?: string;
  icon?: ReactNode;
  onPress?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useApp();
  const children = (
    <>
      {icon ? (
        <View style={{ width: 34, alignItems: "center" }}>{icon}</View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
          {title}
        </Text>
        {detail ? <Muted>{detail}</Muted> : null}
      </View>
      {right ??
        (onPress ? <ChevronRight size={19} color={palette.muted} /> : null)}
    </>
  );
  const rowStyle = [
    {
      minHeight: 72,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 15,
      paddingVertical: 14,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    style,
  ];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={rowStyle}>
      {children}
    </Pressable>
  ) : (
    <View style={rowStyle}>{children}</View>
  );
}
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const { palette } = useApp();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 24,
        borderBottomWidth: 1,
        borderBottomColor: palette.line,
        marginTop: 25,
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.id }}
          onPress={() => onChange(option.id)}
          style={{
            paddingVertical: 15,
            borderBottomWidth: 2,
            borderBottomColor:
              value === option.id ? palette.accent : "transparent",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              color: value === option.id ? palette.ink : palette.muted,
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Checkbox({
  checked,
  onPress,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
}) {
  const { palette } = useApp();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      style={{
        width: 18,
        height: 18,
        borderWidth: 1,
        borderColor: checked ? palette.accent : palette.muted,
        borderRadius: 3,
        backgroundColor: checked ? palette.accent : "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {checked ? <Check size={13} color={palette.bg} /> : null}
    </Pressable>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { palette } = useApp();
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: palette.backdrop,
          padding: 16,
        }}
      >
        <Pressable
          accessibilityLabel="Dismiss dialog"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "85%",
            alignSelf: "center",
            backgroundColor: palette.panel,
            borderColor: palette.line,
            borderWidth: 1,
            borderRadius: 16,
            padding: 22,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Title size={20} style={{ flex: 1 }}>
              {title}
            </Title>
            <IconButton onPress={onClose} label="Close dialog">
              <X size={19} color={palette.muted} />
            </IconButton>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 36,
        paddingHorizontal: 16,
        gap: 18,
        minHeight: 250,
      }}
    >
      {icon}
      <Title size={24} style={{ textAlign: "center" }}>
        {title}
      </Title>
      {children}
    </View>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  const { palette } = useApp();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: 220,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <ActivityIndicator color={palette.accent} />
      <Muted>{label}</Muted>
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 54,
  },
});
