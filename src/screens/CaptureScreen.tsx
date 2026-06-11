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
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCatchFlow } from "../hooks/useCatchFlow";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { CatalogueSearch } from "../components/CatalogueSearch";
import { RevealCard } from "../components/RevealCard";
import { SetCompleteCelebration } from "../components/SetCompleteCelebration";
import { getCurrentLocation } from "../lib/location";
import type { CatalogueCar } from "../lib/collection";
import type { CompletedSet } from "../types";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "../components/ui/Frame";
import { PixelButton } from "../components/ui/PixelButton";

// Vision-camera's `zoom` driven by a Reanimated shared value (smooth pinch).
const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);
Reanimated.addWhitelistedNativeProps({ zoom: true });
const ZOOM_LEVELS = [1, 2, 5];      // multiples of the lens's neutral zoom
const MAX_ZOOM_CAP = 10;            // ignore extreme digital zoom the device reports

export function CaptureScreen() {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const { state, onCapture, onConfirm, onSimulate, reset } = useCatchFlow();
  const [shooting, setShooting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [celebrating, setCelebrating] = useState<CompletedSet[] | null>(null);

  // --- Zoom -----------------------------------------------------------------
  const minZoom = device?.minZoom ?? 1;
  const neutralZoom = device?.neutralZoom ?? 1;
  const maxZoom = Math.min(device?.maxZoom ?? 1, MAX_ZOOM_CAP);

  const zoom = useSharedValue(neutralZoom);
  const zoomStart = useSharedValue(neutralZoom);
  const [zoomMult, setZoomMult] = useState(1);

  // Re-baseline when the device becomes available / changes.
  useEffect(() => {
    zoom.value = neutralZoom;
    setZoomMult(1);
  }, [neutralZoom, zoom]);

  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }), [zoom]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      zoomStart.value = zoom.value;
    })
    .onUpdate((e) => {
      const z = zoomStart.value * e.scale;
      zoom.value = Math.min(Math.max(z, minZoom), maxZoom);
    });

  const setZoom = useCallback(
    (mult: number) => {
      const target = Math.min(Math.max(neutralZoom * mult, minZoom), maxZoom);
      zoom.value = withTiming(target, { duration: 180 });
      setZoomMult(mult);
    },
    [neutralZoom, minZoom, maxZoom, zoom],
  );

  // Only show level buttons the lens can actually reach.
  const zoomLevels = ZOOM_LEVELS.filter(
    (m) => m === 1 || neutralZoom * m <= maxZoom + 0.001,
  );

  const pickManual = useCallback(
    (car: CatalogueCar) => {
      if (state.status !== "confirm" && state.status !== "rejected") return;
      setManualOpen(false);
      onConfirm(
        { carId: car.carId, label: car.label, confidence: 1, rarityTier: car.rarityTier },
        { result: state.result, lat: state.lat, lng: state.lng, photoRef: state.photoPath },
      );
    },
    [state, onConfirm],
  );

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

  const overlays = (
    <>
      {(state.status === "recognizing" || state.status === "recording") && (
        <ScanOverlay>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.overlayStatus}>
            {state.status === "recognizing" ? "SCANNING…" : "LOGGING CATCH…"}
          </Text>
        </ScanOverlay>
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
          onManualSearch={() => setManualOpen(true)}
          onCancel={reset}
        />
      )}

      {state.status === "reveal" && (
        <RevealCard
          result={state.result}
          onDone={() => {
            const done = state.result.completedSets ?? [];
            reset();
            if (done.length > 0) setCelebrating(done);
          }}
        />
      )}

      {state.status === "rejected" && (
        <ScanOverlay>
          <Text style={styles.overlayTitle}>REJECTED</Text>
          <Text style={styles.overlayText}>{rejectionMessage(state.reason)}</Text>
          <PixelButton label="TRY AGAIN" onPress={reset} style={styles.overlayBtn} />
          <Pressable style={styles.ghostLink} onPress={() => setManualOpen(true)}>
            <Text style={styles.ghostLinkText}>▶ SEARCH CATALOGUE MANUALLY</Text>
          </Pressable>
        </ScanOverlay>
      )}

      {state.status === "error" && (
        <ScanOverlay>
          <Text style={styles.overlayTitle}>ERROR</Text>
          <Text style={styles.overlayText}>{state.message}</Text>
          <PixelButton label="BACK" onPress={reset} variant="ghost" style={styles.overlayBtn} />
        </ScanOverlay>
      )}

      {(state.status === "confirm" || state.status === "rejected") && manualOpen && (
        <CatalogueSearch onPick={pickManual} onClose={() => setManualOpen(false)} />
      )}

      {celebrating && (
        <SetCompleteCelebration sets={celebrating} onDone={() => setCelebrating(null)} />
      )}
    </>
  );

  const devSimulate = __DEV__ && state.status === "idle"
    ? (
      <Pressable style={styles.devBtn} onPress={onSimulate}>
        <Text style={styles.devBtnText}>⚡ CHEAT</Text>
      </Pressable>
    )
    : null;

  // Reticle drawn over camera
  const reticle = state.status === "idle" ? (
    <View style={styles.reticle} pointerEvents="none">
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      <Text style={styles.reticleLabel}>POINT AT A CAR</Text>
    </View>
  ) : null;

  if (!hasPermission) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Frame style={styles.noCamFrame}>
          <Text style={styles.noCamTitle}>CAMERA ACCESS</Text>
          <Text style={styles.noCamText}>Camera permission is needed to hunt cars.</Text>
          <PixelButton label="GRANT ACCESS" onPress={requestPermission} style={styles.overlayBtn} />
        </Frame>
        {devSimulate}
        {overlays}
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Frame style={styles.noCamFrame}>
          <Text style={styles.noCamTitle}>NO CAMERA</Text>
          <Text style={styles.noCamText}>
            In Expo Go the camera is unavailable.{"\n"}Use the dev button to test the flow.
          </Text>
        </Frame>
        {devSimulate}
        {overlays}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={pinch}>
        <ReanimatedCamera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={state.status === "idle"}
          photo
          animatedProps={animatedProps}
        />
      </GestureDetector>

      {reticle}

      {state.status === "idle" && (
        <>
          {devSimulate && <View style={styles.devBtnFloat}>{devSimulate}</View>}

          <View style={styles.zoomBar}>
            {zoomLevels.map((m) => {
              const active = zoomMult === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setZoom(m)}
                  style={[styles.zoomBtn, active && styles.zoomBtnActive]}
                  hitSlop={6}
                >
                  <Text style={[styles.zoomText, active && styles.zoomTextActive]}>
                    {m}×
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.shutterBar}>
            <Pressable
              style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
              onPress={shoot}
              disabled={shooting}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </>
      )}

      {overlays}
    </View>
  );
}

function rejectionMessage(reason: string): string {
  switch (reason) {
    case "not_live_capture":
      return "Catches must be taken live in the app.";
    case "not_a_real_car":
      return "That doesn't look like a real car.";
    case "no_match":
      return "Couldn't identify it. Try again or search manually.";
    case "no_cars_seeded":
      return "Catalogue is empty — apply seed migration 0002.";
    default:
      return reason || "Give it another go.";
  }
}

function ScanOverlay({ children }: { children: React.ReactNode }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlayBg]}>
      <View style={styles.overlayContent}>{children}</View>
    </View>
  );
}

const CORNER = 20;
const CORNER_W = 3;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  center: { alignItems: "center", justifyContent: "center", padding: 20 },

  // Reticle
  reticle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: C.accent,
  },
  cornerTL: { top: "30%", left: 28, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerTR: { top: "30%", right: 28, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  cornerBL: { bottom: "30%", left: 28, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerBR: { bottom: "30%", right: 28, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },
  reticleLabel: {
    position: "absolute",
    bottom: "28%",
    fontFamily: F.display,
    fontSize: 7,
    color: C.accent,
    letterSpacing: 2,
    opacity: 0.85,
  },

  // Zoom controls
  zoomBar: {
    position: "absolute",
    bottom: 150,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  zoomBtn: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: "rgba(15,18,28,0.65)",
    alignItems: "center",
  },
  zoomBtnActive: {
    borderColor: C.accent,
    backgroundColor: "rgba(15,18,28,0.85)",
  },
  zoomText: { fontFamily: F.display, fontSize: 8, color: C.textDim, letterSpacing: 1 },
  zoomTextActive: { color: C.accent },

  // Shutter
  shutterBar: { position: "absolute", bottom: 52, left: 0, right: 0, alignItems: "center", gap: 14 },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: C.text,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  shutterPressed: {
    transform: [{ scale: 0.93 }],
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 2,
    backgroundColor: C.text,
  },

  // Overlays
  overlayBg: {
    backgroundColor: "rgba(15,18,28,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayContent: {
    width: "85%",
    alignItems: "center",
    gap: 12,
  },
  overlayStatus: {
    fontFamily: F.display,
    fontSize: 9,
    color: C.accent,
    letterSpacing: 2,
    marginTop: 12,
  },
  overlayTitle: {
    fontFamily: F.display,
    fontSize: 12,
    color: C.red,
    letterSpacing: 2,
    marginBottom: 4,
  },
  overlayText: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 24,
  },
  overlayBtn: { marginTop: 4 },
  ghostLink: { paddingVertical: 12 },
  ghostLinkText: { fontFamily: F.body, color: C.accent, fontSize: 17 },

  // No-camera
  noCamFrame: { width: "88%" },
  noCamTitle: {
    fontFamily: F.display,
    fontSize: 10,
    color: C.text,
    letterSpacing: 2,
    marginBottom: 10,
  },
  noCamText: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 14,
  },

  // Dev simulate
  devBtnFloat: { position: "absolute", top: 60, right: 16 },
  devBtn: {
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  devBtnText: {
    fontFamily: F.display,
    color: C.gold,
    fontSize: 7,
    letterSpacing: 1,
  },
});
