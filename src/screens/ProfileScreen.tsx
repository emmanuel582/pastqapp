import React, { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import Camera from "lucide-react-native/icons/camera";
import MoreHorizontal from "lucide-react-native/icons/ellipsis";
import {
  Screen,
  Text,
  Muted,
  Button,
  IconButton,
  Dialog,
  Row,
  ErrorText,
} from "../components/ui";
import { useApp } from "../state/AppContext";
import { persistAvatar } from "../services/avatar";
import { cancelReminders } from "../services/notifications";
import { fonts } from "../theme/tokens";
import type { Props } from "../navigation/types";
export default function ProfileScreen({ navigation }: Props<"Profile">) {
  const { profile, owner, updateProfile, signOut } = useApp();
  const [name, setName] = useState(profile?.full_name || ""),
    [phone, setPhone] = useState(profile?.phone_number || ""),
    [avatar, setAvatar] = useState(
      profile?.avatar_local_uri || profile?.avatar_url || "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false),
    [logout, setLogout] = useState(false);
  async function photo() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled) return;
      const resized = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      setAvatar(await persistAvatar(owner, resized.uri));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open your photo.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateProfile({
        full_name: name.trim(),
        phone_number: phone.trim(),
        ...(avatar && avatar !== profile?.avatar_url
          ? { avatar_local_uri: avatar }
          : {}),
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }
  const input = {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadfd3",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#2e2a27",
    fontFamily: fonts.outfit,
    fontSize: 15,
    minHeight: 50,
  };
  const label = {
    color: "#374151",
    fontFamily: fonts.serifMedium,
    fontSize: 13,
  };
  return (
    <Screen style={{ backgroundColor: "#fff" }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            minHeight: 52,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#eadfd3",
            backgroundColor: "#fff",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.serifMedium,
              fontWeight: "700",
              fontSize: 16,
              color: "#2e2a27",
            }}
          >
            Edit Profile
          </Text>
          <IconButton
            label="Account options"
            onPress={() => setMenu(true)}
            style={{ width: 32, height: 28 }}
          >
            <MoreHorizontal size={18} color="#8c8681" />
          </IconButton>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 24,
            gap: 24,
          }}
          style={{ backgroundColor: "#faf6f0" }}
        >
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 88, height: 88 }}>
              {avatar ? (
                <Image
                  source={avatar}
                  style={{ width: 88, height: 88, borderRadius: 28 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 28,
                    backgroundColor: "#e67468",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 36,
                      fontFamily: fonts.serifMedium,
                      fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    {name ? name.charAt(0).toUpperCase() : "U"}
                  </Text>
                </View>
              )}
              <IconButton
                label="Change profile photo"
                disabled={busy}
                onPress={() => void photo()}
                style={{
                  position: "absolute",
                  bottom: -8,
                  right: -8,
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#eadfd3",
                  backgroundColor: "#fff",
                }}
              >
                <Camera size={16} color="#8c8681" />
              </IconButton>
            </View>
          </View>
          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={label}>Full Name</Text>
              <TextInput
                accessibilityLabel="Full Name"
                value={name}
                onChangeText={setName}
                maxLength={120}
                style={input}
                editable={!busy}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>Email Address</Text>
              <TextInput
                accessibilityLabel="Email Address"
                value={profile?.email || ""}
                editable={false}
                style={{
                  ...input,
                  backgroundColor: "#f1f5f9",
                  color: "#94a3b8",
                }}
              />
              <Text
                style={{
                  fontFamily: fonts.outfit,
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                Email address cannot be changed.
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>Phone Number</Text>
              <TextInput
                accessibilityLabel="Phone Number"
                value={phone}
                onChangeText={setPhone}
                maxLength={40}
                keyboardType="phone-pad"
                placeholder="e.g. +234 800 000 0000"
                placeholderTextColor="#8c8681"
                style={input}
                editable={!busy}
              />
            </View>
          </View>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#eadfd3",
          }}
        >
          <Button
            busy={busy}
            disabled={busy || !name.trim()}
            onPress={() => void save()}
            buttonStyle={{
              borderWidth: 0,
              borderBottomWidth: 0,
              paddingVertical: 16,
              borderRadius: 16,
              backgroundColor: "#e67468",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.serifMedium,
                fontWeight: "700",
                fontSize: 15,
                color: "#fff",
              }}
            >
              Save Changes
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
      {menu ? (
        <Dialog title="Your account" onClose={() => setMenu(false)}>
          <Row
            title="Back to Preferences"
            onPress={() => {
              setMenu(false);
              navigation.goBack();
            }}
          />
          {[
            {
              title: "Change password",
              action: () => navigation.navigate("Auth", { mode: "recovery" }),
            },
            {
              title: "About focalPoint",
              action: () => navigation.navigate("About"),
            },
            {
              title: "Help & support",
              action: () => navigation.navigate("Support"),
            },
            { title: "Sign out", action: () => setLogout(true) },
          ].map((item) => (
            <Row
              key={item.title}
              title={item.title}
              onPress={() => {
                setMenu(false);
                item.action();
              }}
            />
          ))}
        </Dialog>
      ) : null}
      {logout ? (
        <Dialog title="Sign out?" onClose={() => setLogout(false)}>
          <Muted>
            Your downloads and saved practice stay on this device for your
            account.
          </Muted>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            busy={busy}
            style={{ marginTop: 20 }}
            onPress={() => {
              setBusy(true);
              void cancelReminders(owner)
                .then(signOut)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Sign out
          </Button>
          <Button
            kind="secondary"
            style={{ marginTop: 12 }}
            onPress={() => setLogout(false)}
          >
            Keep studying
          </Button>
        </Dialog>
      ) : null}
    </Screen>
  );
}
