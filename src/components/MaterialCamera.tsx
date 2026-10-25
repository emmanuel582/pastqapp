import { useRef, useState } from "react";
import { Modal, View, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import X from "lucide-react-native/icons/x";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, Button } from "./ui";
import type { UploadFile } from "../services/uploads";
export default function MaterialCamera({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: UploadFile) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions(),
    [ready, setReady] = useState(false),
    [facing, setFacing] = useState<"back" | "front">("back"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    ref = useRef<CameraView>(null),
    insets = useSafeAreaInsets();
  async function capture() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const photo = await ref.current?.takePictureAsync({
        quality: 0.94,
        exif: false,
      });
      if (photo)
        onCapture({
          uri: photo.uri,
          name: "page_" + Date.now() + ".jpg",
          mimeType: "image/jpeg",
          size: 0,
        });
    } catch {
      setError("Could not take this photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#111" }}>
        {permission?.granted ? (
          <CameraView
            key={facing}
            ref={ref}
            style={{ flex: 1 }}
            facing={facing}
            onCameraReady={() => setReady(true)}
            onMountError={() => {
              setReady(false);
              if (facing === "back") {
                setFacing("front");
              } else {
                setError("The camera could not open. Choose a photo instead.");
              }
            }}
            active={!busy}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              gap: 20,
            }}
          >
            <Text style={{ color: "#eee9e1", textAlign: "center" }}>
              Allow camera access to photograph your question paper.
            </Text>
            <Button onPress={() => void requestPermission()}>
              Allow camera
            </Button>
          </View>
        )}
        <Pressable
          accessibilityLabel="Close camera"
          onPress={onClose}
          style={{
            position: "absolute",
            right: 20,
            top: Math.max(18, insets.top),
            width: 48,
            height: 48,
            borderWidth: 1,
            borderColor: "#ffffff40",
            backgroundColor: "#151515b8",
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={22} color="#fff" />
        </Pressable>
        {permission?.granted ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingTop: 20,
              paddingBottom: Math.max(28, insets.bottom),
              paddingHorizontal: 24,
              alignItems: "center",
              gap: 16,
              backgroundColor: "#151515dc",
            }}
          >
            <Text
              style={{ fontSize: 12, color: "#eee9e1", textAlign: "center" }}
            >
              {error || "Keep the whole page in view."}
            </Text>
            <Pressable
              accessibilityLabel="Take photo"
              disabled={!ready || busy}
              onPress={() => void capture()}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 2,
                borderColor: "#eee9e1",
                padding: 5,
                opacity: !ready || busy ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 36,
                  backgroundColor: "#eee9e1",
                }}
              />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
