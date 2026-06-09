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
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { TypewriterText } from "./ui/TypewriterText";

interface Props {
  result: ConfirmResult;
  onDone: () => void;
}

export function RevealCard({ result, onDone }: Props) {
  const { card, isNew } = result;
  const tier = card.rarityTier ?? "common";
  const glow = rarityColor(tier);

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 });
    // Stepped scale pop — snappy like a GBC moment
    scale.value = withSequence(
      withTiming(1.12, { duration: 120, easing: Easing.steps(4, true) }),
      withTiming(0.96, { duration: 80, easing: Easing.steps(2, true) }),
      withTiming(1.04, { duration: 80, easing: Easing.steps(2, true) }),
      withTiming(1, { duration: 60 }),
    );
    glowPulse.value = withDelay(200, withTiming(1, { duration: 500 }));
  }, [opacity, scale, glowPulse]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + glowPulse.value * 0.4,
    transform: [{ scale: 1 + glowPulse.value * 0.08 }],
  }));

  return (
    <Pressable style={styles.backdrop} onPress={onDone}>
      <Animated.View style={[styles.glow, { backgroundColor: glow }, glowStyle]} />

      <Animated.View style={[styles.card, { borderColor: glow }, cardStyle]}>
        {/* Header banner */}
        <View style={[styles.banner, { backgroundColor: glow }]}>
          <Text style={styles.bannerText}>NEW DATA REGISTERED</Text>
        </View>

        {/* NEW / repeat stamp */}
        {isNew
          ? (
            <View style={[styles.stamp, { backgroundColor: glow }]}>
              <Text style={styles.stampText}>NEW!</Text>
            </View>
          )
          : card.spottedCount > 1
            ? (
              <View style={[styles.stamp, { backgroundColor: C.panelHi }]}>
                <Text style={[styles.stampText, { color: C.text }]}>×{card.spottedCount}</Text>
              </View>
            )
            : null}

        {/* Sprite */}
        <View style={styles.spriteWrap}>
          {card.spriteUrl
            ? <Image source={{ uri: card.spriteUrl }} style={styles.sprite} resizeMode="contain" />
            : <View style={styles.spritePlaceholder}><Text style={styles.placeholderText}>?</Text></View>}
        </View>

        {/* Dex number */}
        <Text style={styles.dexNum}>No.{String(card.carId ?? 0).padStart(3, "0")}</Text>

        {/* Typewriter name */}
        <TypewriterText
          text={(card.label ?? "Unknown car").toUpperCase()}
          style={[styles.label, { color: glow }]}
          speed={35}
        />

        <Text style={styles.rarityLabel}>{RARITY_LABEL[tier].toUpperCase()}</Text>
        <Text style={styles.tap}>TAP TO CONTINUE</Text>
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
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  card: {
    width: 270,
    borderWidth: 3,
    backgroundColor: C.panel,
    alignItems: "center",
    overflow: "hidden",
  },
  banner: {
    alignSelf: "stretch",
    paddingVertical: 6,
    alignItems: "center",
  },
  bannerText: {
    fontFamily: F.display,
    fontSize: 7,
    color: C.ink,
    letterSpacing: 1,
  },
  stamp: {
    position: "absolute",
    top: 36,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    zIndex: 2,
  },
  stampText: {
    fontFamily: F.display,
    fontSize: 7,
    color: C.ink,
    letterSpacing: 0.5,
  },
  spriteWrap: {
    width: 200,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 10,
  },
  sprite: { width: 200, height: 130 },
  spritePlaceholder: {
    width: 130,
    height: 110,
    backgroundColor: C.panelHi,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { fontFamily: F.display, color: C.textDim, fontSize: 36 },
  dexNum: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 16,
    letterSpacing: 1,
  },
  label: {
    fontFamily: F.display,
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    marginHorizontal: 14,
    lineHeight: 18,
  },
  rarityLabel: {
    fontFamily: F.display,
    fontSize: 7,
    color: C.textDim,
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 16,
  },
  tap: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 14,
    opacity: 0.7,
  },
});
