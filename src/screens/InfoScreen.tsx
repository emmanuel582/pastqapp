import React, { useState } from "react";
import { Linking, View } from "react-native";
import {
  Screen,
  Header,
  Content,
  Title,
  Text,
  Muted,
  Button,
  Row,
  ErrorText,
} from "../components/ui";
import { useApp } from "../state/AppContext";
import legal from "../../legal/content.json";
import app from "../../app.json";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Routes } from "../navigation/types";
export default function InfoScreen({
  navigation,
  route,
}: NativeStackScreenProps<
  Routes,
  "About" | "Support" | "Privacy" | "Terms" | "DeleteAccount"
>) {
  const { profile } = useApp();
  const [error, setError] = useState("");
  const title = {
    About: "About",
    Support: "Help & privacy",
    Privacy: "Privacy policy",
    Terms: "Terms of use",
    DeleteAccount: "Delete account",
  }[route.name];
  const sections =
    route.name === "Privacy"
      ? legal.privacy
      : route.name === "Terms"
        ? legal.terms
        : route.name === "DeleteAccount"
          ? legal.deletion
          : [];
  async function contact(deletion = false) {
    setError("");
    const subject = deletion
      ? "focalPoint account deletion"
      : "focalPoint support";
    const body = deletion
      ? "Please delete my focalPoint account and associated cloud profile, progress and private uploaded materials.\nAccount email: " +
        (profile?.email || "")
      : "";
    try {
      await Linking.openURL(
        "mailto:" +
          legal.supportEmail +
          "?subject=" +
          encodeURIComponent(subject) +
          "&body=" +
          encodeURIComponent(body),
      );
    } catch {
      setError(
        "Open your email app and send your request to " +
          legal.supportEmail +
          ".",
      );
    }
  }
  return (
    <Screen>
      <Header title={title} onBack={() => navigation.goBack()} />
      <Content
        style={{ maxWidth: 744, paddingTop: 24, paddingBottom: 40, gap: 22 }}
      >
        {route.name === "About" ? (
          <View style={{ gap: 14 }}>
            <Muted>Version {app.expo.version}</Muted>
            <Text>
              focalPoint is an independent study app and is not affiliated with
              WAEC, JAMB or other examination bodies.
            </Text>
            <Row
              title="Help & privacy"
              onPress={() => navigation.navigate("Support")}
            />
          </View>
        ) : null}
        {route.name === "Support" ? (
          <View>
            <Button onPress={() => void contact()}>Email support</Button>
            <Text selectable style={{ marginTop: 12, marginBottom: 24 }}>
              {legal.supportEmail}
            </Text>
            <Row
              title="Privacy policy"
              onPress={() => navigation.navigate("Privacy")}
            />
            <Row
              title="Terms of use"
              onPress={() => navigation.navigate("Terms")}
            />
            <Row
              title="Delete account"
              onPress={() => navigation.navigate("DeleteAccount")}
            />
            <Row title="About" onPress={() => navigation.navigate("About")} />
          </View>
        ) : null}
        {sections.map((section) => (
          <View key={section.title} style={{ gap: 10 }}>
            <Title size={18}>{section.title}</Title>
            <Text>{section.body}</Text>
          </View>
        ))}
        {route.name === "DeleteAccount" ? (
          <View style={{ gap: 12 }}>
            <Button onPress={() => void contact(true)}>
              Request deletion by email
            </Button>
            <Text selectable>{legal.supportEmail}</Text>
          </View>
        ) : null}
        {sections.length ? <Muted>Updated {legal.updated}</Muted> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </Content>
    </Screen>
  );
}
