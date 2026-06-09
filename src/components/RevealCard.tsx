import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { ConfirmResult } from "../types";
import { RARITY_LABEL, rarityColor } from "../lib/rarity";

interface Props {
  result: ConfirmResult;
  onDone: () => void;
}

// The slot-machine moment: card scales/flips in with a rarity-coloured glow.
export function RevealCard({ result, onDone }: Props) {
  const { card, isNew } = result;
  const tier = card.rarityTier ?? "common";
  const glow = rarityColor(tier);

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSequence(
      withTiming(1.06, { duration: 260, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 140 }),
    );
    glowPulse.value = withDelay(200, withTiming(1, { duration: 600 }));
  }, [opacity, scale, glowPulse]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glowPulse.value * 0.45,
    transform: [{ scale: 1 + glowPulse.value * 0.06 }],
  }));

  return (
    <Pressable style={styles.backdrop} onPress={onDone}>
      <Animated.View style={[styles.glow, { backgroundColor: glow }, glowStyle]} />
      <Animated.View style={[styles.card, { borderColor: glow }, cardStyle]}>
        {isNew && (
          <View style={[styles.newBadge, { backgroundColor: glow }]}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}

        <View style={styles.spriteWrap}>
          {card.spriteUrl
            ? <Image source={{ uri: card.spriteUrl }} style={styles.sprite} resizeMode="contain" />
            : <View style={styles.spritePlaceholder}><Text style={styles.placeholderText}>?</Text></View>}
        </View>

        <Text style={styles.label}>{card.label ?? "Unknown car"}</Text>
        <Text style={[styles.rarity, { color: glow }]}>{RARITY_LABEL[tier]}</Text>

        <Text style={styles.meta}>
          {card.spottedCount > 1 ? `Spotted ${card.spottedCount}×` : "First sighting"}
        </Text>

        <Text style={styles.tap}>Tap to continue</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,9,12,0.92)", alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 300, height: 300, borderRadius: 150 },
  card: { width: 280, borderRadius: 20, borderWidth: 2, backgroundColor: "#15171C", paddingVertical: 26, paddingHorizontal: 20, alignItems: "center" },
  newBadge: { position: "absolute", top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  newText: { color: "#0B0C0F", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  spriteWrap: { width: 200, height: 130, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  sprite: { width: 200, height: 130 },
  spritePlaceholder: { width: 130, height: 110, borderRadius: 12, backgroundColor: "#23262E", alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#4A4F58", fontSize: 40, fontWeight: "800" },
  label: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  rarity: { fontSize: 14, fontWeight: "700", marginTop: 4, letterSpacing: 0.5 },
  meta: { color: "#9AA0A6", fontSize: 13, marginTop: 10 },
  tap: { color: "#5A6069", fontSize: 12, marginTop: 22 },
});
