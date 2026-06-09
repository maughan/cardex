import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { CompletedSet } from "../types";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "./ui/Frame";
import { PixelButton } from "./ui/PixelButton";

interface Props {
  sets: CompletedSet[];
  onDone: () => void;
}

// Pixel confetti: GBC palette, square sprites, deterministic positions.
const CONFETTI = [
  { color: C.accent, x: -120, y: -180, d: 0 },
  { color: C.gold, x: 110, y: -200, d: 80 },
  { color: C.purple, x: -160, y: -60, d: 140 },
  { color: C.green, x: 150, y: -90, d: 60 },
  { color: C.red, x: -70, y: -220, d: 200 },
  { color: C.teal, x: 70, y: -150, d: 120 },
  { color: C.orange, x: 180, y: -180, d: 160 },
  { color: C.purple, x: -190, y: -150, d: 40 },
];

function Confetto({ color, x, y, d }: { color: string; x: number; y: number; d: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(d, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [p, d]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: x * p.value },
      { translateY: y * p.value + 40 * p.value * p.value },
      { rotate: `${Math.round(p.value * 3) * 90}deg` }, // stepped rotation
    ],
  }));
  return <Animated.View style={[styles.confetto, { backgroundColor: color }, style]} />;
}

export function SetCompleteCelebration({ sets, onDone }: Props) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 });
    scale.value = withSequence(
      withTiming(1.15, { duration: 120, easing: Easing.steps(4, true) }),
      withTiming(0.96, { duration: 80 }),
      withTiming(1, { duration: 80 }),
    );
  }, [opacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const multiple = sets.length > 1;

  return (
    <Pressable style={styles.backdrop} onPress={onDone}>
      <View style={styles.confettiLayer} pointerEvents="none">
        {CONFETTI.map((c, i) => <Confetto key={i} {...c} />)}
      </View>

      <Animated.View style={cardStyle}>
        <Frame style={styles.card}>
          {/* Gold banner */}
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {multiple ? "SETS COMPLETE!" : "SET COMPLETE!"}
            </Text>
          </View>

          {/* Badge */}
          <View style={styles.medalWrap}>
            <View style={styles.medal}>
              <Text style={styles.medalIcon}>★</Text>
            </View>
          </View>

          {sets.map((s) => (
            <Text key={s.slug} style={styles.setName}>{s.name.toUpperCase()}</Text>
          ))}

          <Text style={styles.sub}>
            {multiple
              ? "YOU FINISHED THESE COLLECTIONS"
              : "EVERY CAR IN THIS COLLECTION CAUGHT"}
          </Text>

          <PixelButton
            label="NICE!"
            onPress={onDone}
            variant="confirm"
            style={styles.btn}
          />
        </Frame>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,13,22,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  confetto: { position: "absolute", width: 10, height: 10, borderRadius: 1 },
  card: {
    width: 290,
    alignItems: "center",
    overflow: "hidden",
    borderColor: C.gold,
    borderWidth: 3,
  },
  banner: {
    alignSelf: "stretch",
    backgroundColor: C.gold,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 14,
    marginHorizontal: -12,
    marginTop: -12,
  },
  bannerText: {
    fontFamily: F.display,
    fontSize: 9,
    color: C.ink,
    letterSpacing: 1,
  },
  medalWrap: { alignItems: "center", marginBottom: 10 },
  medal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.gold + "22",
    borderWidth: 3,
    borderColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  medalIcon: { fontSize: 36, color: C.gold },
  setName: {
    fontFamily: F.display,
    color: C.gold,
    fontSize: 8,
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
  },
  sub: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 22,
  },
  btn: { width: "80%" },
});
