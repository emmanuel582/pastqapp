import React from "react";
import { View } from "react-native";
import { Screen, Wordmark, Content, Title, Button } from "../components/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Routes } from "../navigation/types";
export default function InfoScreen({
  navigation,
  route,
}: NativeStackScreenProps<Routes, "About" | "Support">) {
  const title = route.name === "About" ? "About PastQ" : "Help & support";
  return (
    <Screen>
      <View style={{ paddingVertical: 25, paddingHorizontal: 26 }}>
        <Wordmark />
      </View>
      <Content
        center
        style={{
          maxWidth: 480,
          paddingTop: 32,
          paddingBottom: 80,
          alignItems: "center",
        }}
      >
        <Title size={32} style={{ textAlign: "center" }}>
          {title}
        </Title>
        <Button
          arrow
          onPress={() => navigation.navigate("Main", { tab: "preferences" })}
          style={{ marginTop: 24 }}
        >
          Back to Preferences
        </Button>
      </Content>
    </Screen>
  );
}
