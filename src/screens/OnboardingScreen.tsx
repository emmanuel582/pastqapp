import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import Compass from "lucide-react-native/icons/compass";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Check from "lucide-react-native/icons/check";
import AuthShell from "../components/AuthShell";
import {
  Text,
  Muted,
  SearchField,
  Tabs,
  Button,
  ErrorText,
} from "../components/ui";
import { useApp } from "../state/AppContext";
import { requireAuth } from "../services/auth";
import catalog from "../data/onboarding-catalog.json";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function OnboardingScreen({ navigation }: Props<"Onboarding">) {
  const { palette, profile, updateProfile, session } = useApp();
  const [undergraduate, setUndergraduate] = useState<boolean | null>(null),
    [kind, setKind] = useState<"school" | "exam">("school"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<{ id: string; name: string } | null>(
      null,
    ),
    [limit, setLimit] = useState(5),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const options = useMemo(
    () =>
      kind === "exam"
        ? catalog.exams.map((e) => ({
            id: e.id,
            name: e.n,
            detail: e.b,
            aliases: e.a,
          }))
        : catalog.schools
            .filter((s) => !undergraduate || s.t === "university")
            .map((s) => ({ id: s.id, name: s.n, detail: s.s, aliases: s.a })),
    [kind, undergraduate],
  );
  const preferred = [
    "University of Lagos",
    "University of Ibadan",
    "Ahmadu Bello University",
    "University of Nigeria",
    "University of Port",
  ];
  const matches = options
    .filter((o) =>
      [o.name, ...o.aliases].some((s) =>
        s.toLowerCase().includes(query.toLowerCase()),
      ),
    )
    .sort((a, b) => {
      if (query)
        return (
          Number(
            !a.aliases.some((s) => s.toLowerCase() === query.toLowerCase()),
          ) -
          Number(
            !b.aliases.some((s) => s.toLowerCase() === query.toLowerCase()),
          )
        );
      const rank = (name: string) => {
        const i = preferred.findIndex((s) => name.startsWith(s));
        return i < 0 ? 100 : i;
      };
      return rank(a.name) - rank(b.name);
    });
  async function finish(focus: typeof selected) {
    if (undergraduate === null || busy) return;
    setBusy(true);
    setError("");
    try {
      if (session) {
        const { error } = await requireAuth().auth.updateUser({
          data: {
            is_undergraduate: undergraduate,
            study_preferences: {
              undergraduate,
              focus: focus ? { ...focus, kind } : null,
              completedAt: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;
      }
      await updateProfile({
        onboarding_complete: true,
        undergraduate,
        study_focus: focus ? { ...focus, kind } : null,
      });
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your choice.");
    } finally {
      setBusy(false);
    }
  }
  const first = profile?.full_name.split(/\s+/)[0] || "there";
  return (
    <AuthShell
      title={
        undergraduate === null
          ? "Welcome, " + first + "."
          : undergraduate
            ? "Pick your university."
            : "Make it yours."
      }
      state="encourage"
      onBack={
        undergraduate === null
          ? undefined
          : () => {
              setUndergraduate(null);
              setSelected(null);
            }
      }
    >
      {undergraduate === null ? (
        <View style={{ gap: 14 }}>
          {[
            { value: true, label: "Undergraduate", Icon: GraduationCap },
            { value: false, label: "Other learner", Icon: Compass },
          ].map(({ value, label, Icon }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => setUndergraduate(value)}
              style={{
                minHeight: 92,
                padding: 20,
                borderWidth: 1,
                borderColor: palette.line,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: palette.accentWash,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={24} color={palette.accent} />
              </View>
              <Text
                style={{ fontFamily: fonts.semibold, fontSize: 15, flex: 1 }}
              >
                {label}
              </Text>
              <ArrowRight size={18} color={palette.muted} />
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          {!undergraduate ? (
            <Tabs
              options={[
                { id: "school", label: "School" },
                { id: "exam", label: "Exam" },
              ]}
              value={kind}
              onChange={(v) => {
                setKind(v);
                setSelected(null);
                setQuery("");
                setLimit(5);
              }}
            />
          ) : null}
          <SearchField
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setLimit(5);
            }}
            placeholder={
              undergraduate
                ? "Search university or abbreviation"
                : "Search " + kind
            }
            style={{ marginBottom: 14 }}
          />
          {matches.slice(0, limit).map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected?.id === option.id }}
              onPress={() => setSelected(option)}
              style={{
                padding: 12,
                minHeight: 62,
                borderWidth: 1,
                borderColor:
                  selected?.id === option.id ? palette.accent : palette.line,
                borderRadius: 7,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 4,
                backgroundColor:
                  selected?.id === option.id
                    ? palette.accentWash
                    : "transparent",
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                  {option.name}
                </Text>
                <Muted style={{ fontSize: 11 }}>{option.detail}</Muted>
              </View>
              {selected?.id === option.id ? (
                <Check size={16} color={palette.accent} />
              ) : (
                <GraduationCap size={17} color={palette.muted} />
              )}
            </Pressable>
          ))}
          {!matches.length ? (
            <>
              <Muted>No match yet.</Muted>
              {query.trim() ? (
                <Button
                  kind="text"
                  onPress={() =>
                    setSelected({
                      id: "custom:" + kind + ":" + query.trim().toLowerCase(),
                      name: query.trim(),
                    })
                  }
                >
                  Use “{query.trim()}”
                </Button>
              ) : null}
            </>
          ) : null}
          {matches.length > limit ? (
            <Button kind="text" onPress={() => setLimit((v) => v + 8)}>
              Show more
            </Button>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            arrow
            disabled={!selected || busy}
            busy={busy}
            onPress={() => void finish(selected)}
            style={{ marginTop: 18 }}
          >
            Let’s go
          </Button>
          {!undergraduate ? (
            <Button
              kind="text"
              disabled={busy}
              onPress={() => void finish(null)}
            >
              Explore without choosing
            </Button>
          ) : null}
        </>
      )}
    </AuthShell>
  );
}
