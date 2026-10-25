import { useEffect, useState, useRef } from "react";
import { View, Pressable } from "react-native";
import { Image } from "expo-image";
import {
  Screen,
  Header,
  Content,
  Text,
  Muted,
  Button,
  Field,
  ErrorText,
  Checkbox,
  Row,
} from "../components/ui";
import StudySwitch from "../components/StudySwitch";
import { useApp } from "../state/AppContext";
import {
  getReminders,
  saveReminders,
  reminderDefaults,
  type ReminderSettings,
  type ReminderSnapshot,
} from "../services/reminders";
import { scheduleReminders } from "../services/notifications";
import * as records from "../storage/records";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function RemindersScreen({ navigation }: Props<"Reminders">) {
  const { owner, palette, preferences, setPreferences, attempts } = useApp();
  const [draft, setDraft] = useState<ReminderSettings>({
      ...reminderDefaults,
      ...preferences.reminders,
      mode: preferences.reminders.mode === "smart" ? "smart" : "scheduled",
    }),
    [snapshot, setSnapshot] = useState<ReminderSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const edited = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    void records
      .read<ReminderSettings>(owner, "reminders", "current")
      .then((saved) => {
        if (saved && !abort.signal.aborted && !edited.current) setDraft(saved);
      })
      .catch(() => {});
    void getReminders(owner, abort.signal)
      .then(async (value) => {
        const pending = await records.read(owner, "reminder-outbox", "current");
        if (!abort.signal.aborted && !edited.current && !pending) {
          setSnapshot(value);
          setDraft(value.settings);
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, [owner]);
  function patch(value: Partial<ReminderSettings>) {
    edited.current = true;
    setDraft((d) => ({ ...d, ...value }));
    setStatus("");
  }
  async function save(value = draft) {
    value = {
      ...value,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || value.timezone,
    };
    if (busy) return;
    edited.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.quietStart) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.quietEnd)
      )
        throw new Error("Enter times as HH:MM, for example 18:00.");
      const studiedDays = attempts
        .filter((a) => a.status === "completed")
        .map((a) => {
          const d = new Date(a.completedAt!);
          return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        });
      await scheduleReminders(owner, value, snapshot?.preview, studiedDays);
      await records.commit(owner, [
        { kind: "reminders", id: "current", value },
        { kind: "reminder-outbox", id: "current", value },
      ]);
      await setPreferences({
        ...preferences,
        reminders: {
          enabled: value.enabled,
          mode: value.mode === "smart" ? "smart" : "fixed",
          time: value.time,
          days: value.days,
          personalized: value.personalized,
        },
      });
      setDraft(value);
      try {
        setSnapshot(await saveReminders(owner, value));
        await records.compareAndSwap(
          owner,
          "reminder-outbox",
          "current",
          value,
          null,
        );
        setStatus("Reminder settings saved.");
      } catch {
        setStatus(
          "Saved on this device. Account settings will sync when connected.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save reminders.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title="Study reminders" onBack={() => navigation.goBack()} />
      <Content style={{ paddingTop: 24, maxWidth: 600 }}>
        <Row
          title={
            draft.pausedUntil && Date.parse(draft.pausedUntil) > Date.now()
              ? "Reminders paused"
              : "Study reminders"
          }

          right={
            <StudySwitch
              label="Study reminders"
              checked={draft.enabled}
              disabled={busy}
              onChange={(enabled) => void save({ ...draft, enabled })}
            />
          }
        />
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            padding: 18,
            marginVertical: 26,
            borderWidth: 1,
            borderColor: palette.line,
            borderRadius: 18,
            backgroundColor: palette.panel,
          }}
        >
          <Image
            source={require("../../assets/scholar/reminders/welcome-v1.jpg")}
            style={{ width: 76, height: 76, borderRadius: 14 }}
          />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontFamily: fonts.semibold }}>
              {draft.personalized
                ? snapshot?.preview.title || "A study moment with Scholar"
                : "A study moment with Scholar"}
            </Text>
            <Muted>
              {draft.personalized
                ? snapshot?.preview.body ||
                  "Come back for a short practice session."
                : "Come back for a short practice session."}
            </Muted>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.semibold, marginBottom: 16 }}>
          Timing
        </Text>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: palette.control,
            padding: 4,
            borderRadius: 10,
            gap: 4,
          }}
        >
          {(
            [
              { id: "smart", label: "Smart" },
              { id: "scheduled", label: "Choose a time" },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => patch({ mode: item.id })}
              style={{
                flex: 1,
                paddingVertical: 11,
                paddingHorizontal: 8,
                borderRadius: 7,
                backgroundColor:
                  draft.mode === item.id ? palette.panel : "transparent",
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: draft.mode === item.id ? palette.ink : palette.muted,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {draft.mode === "scheduled" ? (
          <View style={{ marginTop: 18 }}>
            <Field
              label="Reminder time"
              value={draft.time}
              onChangeText={(time) => patch({ time })}
              placeholder="18:00"
            />
          </View>
        ) : (
          <Muted style={{ marginTop: 14 }}>
            Around {snapshot?.preview.targetTime || draft.time}.
          </Muted>
        )}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 6,
            marginTop: 20,
            marginBottom: 24,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 0].map((day, i) => (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityLabel={
                [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ][i]
              }
              accessibilityState={{ checked: draft.days.includes(day) }}
              onPress={() => {
                const days = draft.days.includes(day)
                  ? draft.days.filter((d) => d !== day)
                  : [...draft.days, day];
                if (days.length) patch({ days });
              }}
              style={{
                width: 36,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: draft.days.includes(day)
                  ? palette.button
                  : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: draft.days.includes(day)
                    ? palette.onButton
                    : palette.muted,
                }}
              >
                {["M", "T", "W", "T", "F", "S", "S"][i]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View
          style={{
            paddingTop: 22,
            paddingBottom: 24,
            borderTopWidth: 1,
            borderTopColor: palette.line,
            gap: 16,
          }}
        >
          <Text style={{ fontFamily: fonts.semibold }}>Quiet hours</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="From"
                value={draft.quietStart}
                onChangeText={(quietStart) => patch({ quietStart })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Until"
                value={draft.quietEnd}
                onChangeText={(quietEnd) => patch({ quietEnd })}
              />
            </View>
          </View>
          <Muted style={{ fontSize: 11 }}>
            {draft.timezone.replace(/_/g, " ")}
          </Muted>
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            paddingBottom: 24,
            alignItems: "center",
          }}
        >
          <Checkbox
            checked={draft.personalized}
            label="Include study details in reminders"
            onPress={() => patch({ personalized: !draft.personalized })}
          />
          <Text style={{ fontSize: 12 }}>
            Include study details in reminders
          </Text>
        </View>
        <Button busy={busy} onPress={() => void save()}>
          Save changes
        </Button>
        {draft.enabled ? (
          <Button
            kind="text"
            onPress={() =>
              void save({
                ...draft,
                pausedUntil: new Date(Date.now() + 86400000).toISOString(),
              })
            }
          >
            Pause for today
          </Button>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {status ? <Muted style={{ marginTop: 18 }}>{status}</Muted> : null}
      </Content>
    </Screen>
  );
}
