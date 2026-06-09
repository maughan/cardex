import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { RARITY_LABEL, rarityColor } from "../../lib/rarity";
import type { RarityTier } from "../../types";
import { C } from "../../theme/colors";
import { F } from "../../theme/type";

interface Props {
  tier: RarityTier;
  style?: ViewStyle;
}

export function RarityChip({ tier, style }: Props) {
  const color = rarityColor(tier);
  return (
    <View style={[styles.chip, { borderColor: color }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{RARITY_LABEL[tier]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: C.panel,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  label: {
    fontFamily: F.display,
    fontSize: 6,
    letterSpacing: 0.5,
  },
});
