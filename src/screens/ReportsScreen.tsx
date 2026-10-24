import React, { useEffect, useState } from "react";
import { View, FlatList } from "react-native";
import { Screen, Header, Text, Muted, Button, Empty } from "../components/ui";
import { useApp } from "../state/AppContext";
import { syncReports } from "../services/reports";
import * as records from "../storage/records";
import Skeleton from "../components/Skeleton";
import type { QuestionReport } from "../domain/types";
import type { Props } from "../navigation/types";
export default function ReportsScreen({ navigation }: Props<"Reports">) {
  const { owner, palette } = useApp(),
    [rows, setRows] = useState<QuestionReport[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void records.list<QuestionReport>(owner, "report").then((value) => {
      if (active) setRows(value);
    });
    void syncReports(owner)
      .then(() => records.list<QuestionReport>(owner, "report"))
      .then((value) => {
        if (active) setRows(value);
      })
      .catch(() => {
        if (active) setError("Showing reports saved on this device.");
      });
    return () => {
      active = false;
    };
  }, [owner]);
  const labels: Record<string, string> = {
    queued: "Waiting for connection",
    received: "Received",
    reviewing: "Under review",
    corrected: "Corrected",
    no_change: "Reviewed",
  };
  return (
    <Screen>
      <Header title="Question reports" onBack={() => navigation.goBack()} />
      <FlatList
        data={rows || []}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: 24,
          maxWidth: 800,
          width: "100%",
          alignSelf: "center",
        }}
        ListHeaderComponent={<View>{!rows ? <Skeleton /> : null}</View>}
        renderItem={({ item }) => (
          <View
            style={{
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 13 }}>
                {item.subject}
                {item.year ? " · " + item.year : ""}
              </Text>
              <Muted>{labels[item.status] || item.status}</Muted>
            </View>
            {item.note ? (
              <Text style={{ fontSize: 13 }}>{item.note}</Text>
            ) : null}
            {item.resolution ? <Muted>{item.resolution}</Muted> : null}
            {item.status === "corrected" ? (
              <Button
                kind="text"
                onPress={() =>
                  navigation.navigate("Download", {
                    ids: [item.bundleId],
                    title: "Update material",
                  })
                }
              >
                Update saved material
              </Button>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View>{rows ? <Empty title="No reports yet." /> : null}</View>
        }
        ListFooterComponent={
          <View>
            {error ? <Muted style={{ marginTop: 14 }}>{error}</Muted> : null}
          </View>
        }
      />
    </Screen>
  );
}
