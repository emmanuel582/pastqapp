import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Download from "lucide-react-native/icons/download";
import { useApp } from "../state/AppContext";
import * as records from "../storage/records";
import { Row } from "./ui";
import type { Navigation } from "../navigation/types";
import type { Manifest } from "../services/library";
export default function PendingDownloads({
  navigation,
}: {
  navigation: Navigation;
}) {
  const { owner, palette, saved } = useApp(),
    [plans, setPlans] = useState<{ manifest: Manifest; selected: string[] }[]>(
      [],
    );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        void records
          .list<{ manifest: Manifest; selected: string[] }>(
            owner,
            "download-plan",
          )
          .then((rows) => {
            if (active)
              setPlans(
                rows.filter(
                  (p) => p.manifest?.bundle?.id && p.selected?.length,
                ),
              );
          })
          .catch(() => {});
      };
      refresh();
      const timer = setInterval(refresh, 5000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [owner, saved]),
  );
  return (
    <>
      {plans.map((p) => (
        <Row
          key={p.manifest.bundle.id}
          title={"Continue " + p.manifest.bundle.title}
          detail="Your downloaded parts are kept"
          icon={<Download size={18} color={palette.accent} />}
          onPress={() =>
            navigation.navigate("Download", {
              ids: [p.manifest.bundle.id],
              title: p.manifest.bundle.title,
              mode: "resume",
            })
          }
        />
      ))}
    </>
  );
}
