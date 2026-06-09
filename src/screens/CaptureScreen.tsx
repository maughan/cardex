import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { useCatchFlow } from "../hooks/useCatchFlow";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { RevealCard } from "../components/RevealCard";
import { getCurrentLocation } from "../lib/location";

export function CaptureScreen() {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const { state, onCapture, onConfirm, reset } = useCatchFlow();
  const [shooting, setShooting] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const shoot = useCallback(async () => {
    if (!camera.current || shooting) return;
    setShooting(true);
    try {
      const photo = await camera.current.takePhoto({ flash: "off" });
      const loc = await getCurrentLocation();
      await onCapture(photo.path, loc?.lat ?? null, loc?.lng ?? null);
    } catch {
      // surfaced by the flow's error state on the recognize call; ignore here
    } finally {
      setShooting(false);
    }
  }, [shooting, onCapture]);

  if (!hasPermission) {
    return (
      <Center>
        <Text style={styles.msg}>Camera permission is needed to hunt cars.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant access</Text>
        </Pressable>
      </Center>
    );
  }
  if (device == null) {
    return <Center><Text style={styles.msg}>No camera device found.</Text></Center>;
  }

  return (
    <View style={styles.fill}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={state.status === "idle"}
        photo
      />

      {state.status === "idle" && (
        <View style={styles.shutterBar}>
          <Text style={styles.hint}>Point at a car and tap to catch</Text>
          <Pressable style={styles.shutter} onPress={shoot} disabled={shooting}>
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      )}

      {(state.status === "recognizing" || state.status === "recording") && (
        <Overlay>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>
            {state.status === "recognizing" ? "Identifying…" : "Logging your catch…"}
          </Text>
        </Overlay>
      )}

      {state.status === "confirm" && (
        <ConfirmSheet
          candidates={state.result.candidates}
          onPick={(c) =>
            onConfirm(c, {
              result: state.result,
              lat: state.lat,
              lng: state.lng,
              photoRef: state.photoPath,
            })}
          onManualSearch={reset /* TODO: open manual catalogue search */}
          onCancel={reset}
        />
      )}

      {state.status === "reveal" && (
        <RevealCard result={state.result} onDone={reset} />
      )}

      {state.status === "rejected" && (
        <Overlay>
          <Text style={styles.overlayTitle}>That didn’t count</Text>
          <Text style={styles.overlayText}>{rejectionMessage(state.reason)}</Text>
          <Pressable style={styles.btn} onPress={reset}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </Overlay>
      )}

      {state.status === "error" && (
        <Overlay>
          <Text style={styles.overlayTitle}>Something went wrong</Text>
          <Text style={styles.overlayText}>{state.message}</Text>
          <Pressable style={styles.btn} onPress={reset}>
            <Text style={styles.btnText}>Back</Text>
          </Pressable>
        </Overlay>
      )}
    </View>
  );
}

function rejectionMessage(reason: string): string {
  switch (reason) {
    case "not_live_capture":
      return "Catches must be taken live in the app — no screenshots or saved photos.";
    case "not_a_real_car":
      return "That doesn’t look like a real car. Point at the real thing!";
    case "no_match":
      return "Couldn’t identify it. Try again, or search the catalogue manually.";
    default:
      return "Give it another go.";
  }
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.fill, styles.center]}>{children}</View>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <View style={[StyleSheet.absoluteFill, styles.center, styles.overlay]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0B0C0F" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  overlay: { backgroundColor: "rgba(8,9,12,0.78)" },
  overlayTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  overlayText: { color: "#C7CCD2", fontSize: 15, textAlign: "center", marginTop: 12 },
  msg: { color: "#C7CCD2", fontSize: 16, textAlign: "center", marginBottom: 16 },
  shutterBar: { position: "absolute", bottom: 48, left: 0, right: 0, alignItems: "center" },
  hint: { color: "#fff", fontSize: 14, marginBottom: 18, opacity: 0.9 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  btn: { marginTop: 20, backgroundColor: "#2F80ED", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
