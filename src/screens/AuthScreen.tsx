import React, { useRef, useState } from "react";
import { View, TextInput } from "react-native";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Check from "lucide-react-native/icons/check";
import Svg, { Path } from "react-native-svg";
import AuthShell from "../components/AuthShell";
import {
  Button,
  Field,
  Text,
  Muted,
  ErrorText,
  IconButton,
} from "../components/ui";
import { requireAuth, signInGoogle, authCallbackUrl } from "../services/auth";
import { useApp } from "../state/AppContext";
import type { Props } from "../navigation/types";
import { fonts } from "../theme/tokens";
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20">
      <Path
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.4c-.23 1.22-.95 2.25-2.01 2.94v2.44h3.26c1.9-1.75 3-4.32 3-7.17z"
        fill="#4285F4"
      />
      <Path
        d="M10 20c2.7 0 4.96-.9 6.61-2.43l-3.26-2.44c-.9.6-2.05.96-3.35.96-2.58 0-4.77-1.74-5.55-4.08H1.1v2.52A10 10 0 0 0 10 20z"
        fill="#34A853"
      />
      <Path
        d="M4.45 12.01A5.97 5.97 0 0 1 4.14 10c0-.7.12-1.37.31-2.01V5.47H1.1A10 10 0 0 0 0 10c0 1.61.39 3.14 1.1 4.53l3.35-2.52z"
        fill="#FBBC05"
      />
      <Path
        d="M10 3.92c1.45 0 2.76.5 3.78 1.48l2.83-2.83A9.97 9.97 0 0 0 10 0 10 10 0 0 0 1.1 5.47l3.35 2.52c.78-2.34 2.97-4.07 5.55-4.07z"
        fill="#EA4335"
      />
    </Svg>
  );
}
export default function AuthScreen({ route, navigation }: Props<"Auth">) {
  const { palette } = useApp(),
    { mode } = route.params;
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState<"email" | "google" | null>(null),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    lock = useRef(false);
  const signup = mode === "signup",
    reset = mode === "reset",
    recovery = mode === "recovery";
  async function submit(method: "email" | "google") {
    if (lock.current) return;
    if (method === "email" && signup && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (
      method === "email" &&
      !recovery &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError("Please enter a valid email address.");
      return;
    }
    if (
      method === "email" &&
      !reset &&
      password.length < (signup || recovery ? 8 : 1)
    ) {
      setError(
        "Please enter your password. At least 8 characters for a new password.",
      );
      return;
    }
    lock.current = true;
    setBusy(method);
    setError("");
    try {
      if (method === "google") {
        await signInGoogle();
        return;
      }
      const client = requireAuth();
      if (reset) {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authCallbackUrl() },
        );
        if (error) throw error;
        setSent(true);
      } else if (recovery) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await client.auth.signOut({ scope: "local" });
        setSent(true);
      } else {
        // Use the same Supabase account provider as the browser. The SDK persists and refreshes this session.
        const result = signup
          ? await client.auth.signUp({
              email: email.trim(),
              password,
              options: { data: { full_name: name.trim() } },
            })
          : await client.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
        if (result.error) throw result.error;
        if (!result.data.session) {
          if (signup) setSent(true);
          else throw new Error("Sign in did not finish. Please try again.");
        }
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }
  const first = Array.from(name.trim().split(/\s+/)[0] || "")
    .slice(0, 12)
    .join("");
  return (
    <AuthShell
      title={
        sent
          ? recovery
            ? "Password updated."
            : "Check your inbox."
          : recovery
            ? "Your new password."
            : reset
              ? "Forgot password?"
              : signup
                ? "Create account."
                : "Welcome back."
      }
      greeting={
        signup && !sent
          ? first
            ? "Hey, " + first + "."
            : "Hey there."
          : undefined
      }
      state={busy ? "waiting" : sent ? "encourage" : "idle"}
    >
      {sent ? (
        <View style={{ gap: 18 }}>
          <Check size={28} color={palette.accent} />
          {!recovery ? (
            <Muted>
              {signup
                ? "Confirm your email to continue."
                : "If an account exists, a reset link will arrive shortly."}
            </Muted>
          ) : null}
          <Button
            kind="text"
            onPress={() => {
              setSent(false);
              navigation.replace("Auth", { mode: "login" });
            }}
          >
            Back to sign in
          </Button>
        </View>
      ) : (
        <>
          <View style={{ gap: 15 }}>
            {signup ? (
              <Field
                label="Full name"
                placeholder="Your full name"
                value={name}
                onChangeText={setName}
                maxLength={120}
                autoComplete="name"
                editable={!busy}
              />
            ) : null}
            {!recovery ? (
              <Field
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                maxLength={254}
                autoComplete="email"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!busy}
              />
            ) : null}
            {!reset ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                  Password
                </Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    accessibilityLabel="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder={signup ? "Create a password" : "Your password"}
                    placeholderTextColor={palette.faint}
                    secureTextEntry={!show}
                    autoCapitalize="none"
                    autoComplete={
                      signup || recovery ? "new-password" : "current-password"
                    }
                    maxLength={128}
                    editable={!busy}
                    style={{
                      height: 46,
                      paddingLeft: 13,
                      paddingRight: 50,
                      borderWidth: 1,
                      borderColor: palette.line,
                      borderRadius: 8,
                      color: palette.ink,
                      fontFamily: fonts.body,
                      fontSize: 16,
                      backgroundColor: palette.control,
                    }}
                  />
                  <IconButton
                    label={show ? "Hide password" : "Show password"}
                    onPress={() => setShow((v) => !v)}
                    style={{ position: "absolute", right: 1, top: 1 }}
                  >
                    {show ? (
                      <EyeOff size={18} color={palette.muted} />
                    ) : (
                      <Eye size={18} color={palette.muted} />
                    )}
                  </IconButton>
                </View>
                {signup || recovery ? (
                  <Muted style={{ fontSize: 11 }}>At least 8 characters.</Muted>
                ) : null}
              </View>
            ) : null}
            {!signup && !reset && !recovery ? (
              <Button
                kind="text"
                onPress={() => navigation.push("Auth", { mode: "reset" })}
                style={{ alignSelf: "flex-end", marginTop: -8 }}
              >
                Forgot password?
              </Button>
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button
              arrow
              busy={busy === "email"}
              disabled={!!busy}
              onPress={() => void submit("email")}
            >
              {recovery
                ? "Update password"
                : reset
                  ? "Send reset link"
                  : signup
                    ? "Create account"
                    : "Sign in"}
            </Button>
          </View>
          {!reset && !recovery ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  marginVertical: 16,
                }}
              >
                <View
                  style={{ height: 1, flex: 1, backgroundColor: palette.line }}
                />
                <Muted style={{ fontSize: 11 }}>or</Muted>
                <View
                  style={{ height: 1, flex: 1, backgroundColor: palette.line }}
                />
              </View>
              <Button
                kind="secondary"
                disabled={!!busy}
                onPress={() => void submit("google")}
              >
                <GoogleMark />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                  {busy === "google" ? "Connecting…" : "Continue with Google"}
                </Text>
              </Button>
              <Button
                kind="text"
                disabled={!!busy}
                onPress={() =>
                  navigation.replace("Auth", {
                    mode: signup ? "login" : "signup",
                  })
                }
                style={{ marginTop: 16 }}
              >
                {signup ? "Sign in" : "Create an account"}
              </Button>
            </>
          ) : null}
        </>
      )}
    </AuthShell>
  );
}
