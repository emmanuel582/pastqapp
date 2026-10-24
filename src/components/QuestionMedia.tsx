import { trustedApiUrl } from "../domain/contracts";
import React, { useState } from "react";
import { View, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Plus from "lucide-react-native/icons/plus";
import Minus from "lucide-react-native/icons/minus";
import { useApp } from "../state/AppContext";
import type { Asset, Figure } from "../domain/types";
import { API_BASE } from "../services/api";
import { Muted, Dialog, IconButton } from "./ui";
import RichText from "./RichText";
export function figureSource(url: string, assets?: Record<string, Asset>) {
  const key = url.match(/^pastq-asset:([a-f0-9]{64})$/)?.[1];
  if (key) {
    const a = assets?.[key];
    return a ? "data:" + a.mime + ";base64," + a.data : null;
  }
  if (
    /^data:image\/(png|jpeg|webp|gif);base64,/.test(url) ||
    /^https:\/\//.test(url)
  )
    return url;
  if (url.startsWith("/") && !url.startsWith("//")) return API_BASE + url;
  return null;
}
export default function QuestionMedia({
  passage,
  figures,
  assets,
}: {
  passage?: string | null;
  figures?: Figure[];
  assets?: Record<string, Asset>;
}) {
  const { palette, session } = useApp(),
    [zoom, setZoom] = useState<string | null>(null),
    [scale, setScale] = useState(1),
    { width } = useWindowDimensions();
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {passage ? (
        <View
          style={{
            padding: 18,
            backgroundColor: palette.wash,
            borderWidth: 1,
            borderColor: palette.line,
            borderRadius: 5,
          }}
        >
          <RichText
            text={passage}
            html={
              /<(?:p|div|table|img|math)\b/i.test(passage) ? passage : undefined
            }
            assets={assets}
            size={13}
          />
        </View>
      ) : null}
      {figures?.map((figure, index) => {
        const url = figureSource(figure.url || figure.src || "", assets);
        if (!url)
          return (
            <Muted key={index}>
              Image unavailable. Reopen this material when connected.
            </Muted>
          );
        const source = {
          uri: url,
          ...(trustedApiUrl(url, API_BASE) && session
            ? { headers: { Authorization: "Bearer " + session.access_token } }
            : {}),
        };
        return (
          <Pressable
            key={index}
            onPress={() => {
              setZoom(url);
              setScale(1);
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={
              figure.alt || figure.caption || "Enlarge question diagram"
            }
            style={{
              backgroundColor:
                palette.scheme === "dark" ? "#e8e3da" : "#fffdf9",
              borderRadius: 5,
              padding: 8,
            }}
          >
            <Image
              source={source}
              contentFit="contain"
              style={{
                width: "100%",
                height: Math.min(
                  260,
                  ((width - 56) * (figure.height || 200)) /
                    (figure.width || 300),
                ),
              }}
              cachePolicy="disk"
            />
            {figure.caption ? (
              <Muted
                style={{
                  textAlign: "center",
                  color: "#5a554f",
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                {figure.caption}
              </Muted>
            ) : null}
          </Pressable>
        );
      })}
      {zoom ? (
        <Dialog title="Question diagram" onClose={() => setZoom(null)}>
          <ScrollView horizontal>
            <ScrollView>
              <Image
                source={{
                  uri: zoom,
                  ...(trustedApiUrl(zoom, API_BASE) && session
                    ? {
                        headers: {
                          Authorization: "Bearer " + session.access_token,
                        },
                      }
                    : {}),
                }}
                contentFit="contain"
                style={{
                  width: (width - 80) * scale,
                  height: 300 * scale,
                  backgroundColor: "#fff",
                }}
              />
            </ScrollView>
          </ScrollView>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
            }}
          >
            <IconButton
              label="Zoom out"
              onPress={() => setScale((v) => Math.max(0.5, v - 0.25))}
            >
              <Minus size={18} color={palette.muted} />
            </IconButton>
            <Muted>{Math.round(scale * 100)}%</Muted>
            <IconButton
              label="Zoom in"
              onPress={() => setScale((v) => Math.min(3, v + 0.25))}
            >
              <Plus size={18} color={palette.muted} />
            </IconButton>
          </View>
        </Dialog>
      ) : null}
    </View>
  );
}
