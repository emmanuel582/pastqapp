import { useState } from "react";
import { FlatList, Pressable } from "react-native";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import Check from "lucide-react-native/icons/check";
import { useApp } from "../state/AppContext";
import { Text, Dialog } from "./ui";
export default function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    { palette } = useApp();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          label +
          ": " +
          (options.find((o) => o.value === value)?.label || value)
        }
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: palette.line,
          borderRadius: 6,
          backgroundColor: palette.control,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          maxWidth: "70%",
        }}
      >
        <Text style={{ fontSize: 13, flexShrink: 1 }}>
          {options.find((o) => o.value === value)?.label || value}
        </Text>
        <ChevronDown size={16} color={palette.muted} />
      </Pressable>
      {open ? (
        <Dialog title={label} onClose={() => setOpen(false)}>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={{
                  minHeight: 52,
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: palette.line,
                }}
              >
                <Text style={{ flex: 1 }}>{item.label}</Text>
                {item.value === value ? (
                  <Check size={18} color={palette.accent} />
                ) : null}
              </Pressable>
            )}
          />
        </Dialog>
      ) : null}
    </>
  );
}
