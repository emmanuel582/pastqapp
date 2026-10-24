import React, { useState } from "react";
import { useApp } from "../state/AppContext";
import { cancelReminders } from "../services/notifications";
import { Dialog, Row, Text, Muted, Button, ErrorText } from "./ui";
import type { Navigation } from "../navigation/types";
/** Account controls remain reachable when the optional Profile entry is hidden. */
export default function AccountOptions({
  open,
  onClose,
  navigation,
}: {
  open: boolean;
  onClose: () => void;
  navigation: Navigation;
}) {
  const { profile, owner, signOut } = useApp();
  const [logout, setLogout] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      {open ? (
        <Dialog title="Your account" onClose={onClose}>
          <Text selectable style={{ fontSize: 12, marginBottom: 12 }}>
            {profile?.email || "Signed in"}
          </Text>
          <Row
            title="Change password"
            onPress={() => {
              onClose();
              navigation.navigate("Auth", { mode: "recovery" });
            }}
          />
          <Row
            title="About focalPoint"
            onPress={() => {
              onClose();
              navigation.navigate("About");
            }}
          />
          <Row
            title="Help & privacy"
            onPress={() => {
              onClose();
              navigation.navigate("Support");
            }}
          />
          <Row
            title="Sign out"
            onPress={() => {
              onClose();
              setError("");
              setLogout(true);
            }}
          />
        </Dialog>
      ) : null}
      {logout ? (
        <Dialog
          title="Sign out?"
          onClose={() => {
            if (!busy) setLogout(false);
          }}
        >
          <Muted>
            Your downloads and saved practice stay on this device for your
            account.
          </Muted>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            busy={busy}
            onPress={() => {
              if (busy) return;
              setBusy(true);
              void cancelReminders(owner)
                .then(signOut)
                .catch((e) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not sign out. Try again.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
            style={{ marginTop: 20 }}
          >
            Sign out
          </Button>
          <Button
            kind="secondary"
            disabled={busy}
            onPress={() => setLogout(false)}
            style={{ marginTop: 12 }}
          >
            Keep studying
          </Button>
        </Dialog>
      ) : null}
    </>
  );
}
