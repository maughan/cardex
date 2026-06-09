import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { C } from "../../theme/colors";
import { F } from "../../theme/type";
import { RARITY_LABEL, rarityColor } from "../../lib/rarity";
import type { RarityTier } from "../../types";

interface Props {
  dexNumber?: number;
  label: string;
  rarityTier: RarityTier;
  spriteUrl?: string | null;
  spottedCount?: number;
  style?: ViewStyle;
  locked?: boolean;
}

export function PixelCard({ dexNumber, label, rarityTier, spriteUrl, spottedCount, style, locked }: Props) {
  const accent = locked ? C.line : rarityColor(rarityTier);
  return (
    <View style={[styles.card, { borderColor: accent }, locked && styles.locked, style]}>
      {/* Rarity ribbon */}
      <View style={[styles.ribbon, { backgroundColor: accent }]}>
        <Text style={styles.ribbonText}>{locked ? "???" : RARITY_LABEL[rarityTier]}</Text>
      </View>

      {/* Sprite area */}
      <View style={styles.spriteWrap}>
        {!locked && spriteUrl
          ? <Image source={{ uri: spriteUrl }} style={styles.sprite} resizeMode="contain" />
          : <Text style={[styles.silhouette, { color: locked ? C.panelHi : C.textDim }]}>?</Text>}
      </View>

      {/* Dex number */}
      {dexNumber != null && (
        <Text style={[styles.dexNum, { color: C.textDim }]}>No.{String(dexNumber).padStart(3, "0")}</Text>
      )}

      {/* Name */}
      <Text style={[styles.name, locked && styles.nameLocked]} numberOfLines={2}>
        {locked ? "???" : label}
      </Text>

      {/* Count badge */}
      {!locked && spottedCount != null && spottedCount > 1 && (
        <Text style={styles.count}>×{spottedCount}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.panel,
    borderWidth: 2,
    borderRadius: 2,
    padding: 6,
    alignItems: "center",
    overflow: "hidden",
  },
  locked: {
    opacity: 0.55,
  },
  ribbon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: "center",
  },
  ribbonText: {
    fontFamily: F.display,
    fontSize: 5,
    color: C.ink,
    letterSpacing: 0.3,
  },
  spriteWrap: {
    width: "100%",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 4,
  },
  sprite: {
    width: "100%",
    height: 56,
  },
  silhouette: {
    fontSize: 28,
    fontFamily: F.display,
  },
  dexNum: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.textDim,
  },
  name: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.text,
    textAlign: "center",
    marginTop: 1,
    lineHeight: 17,
  },
  nameLocked: {
    color: C.textDim,
  },
  count: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.textDim,
    marginTop: 1,
  },
});
