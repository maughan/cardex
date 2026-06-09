import React from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";
import { C } from "../../theme/colors";

interface Props {
  pct: number; // 0–100
  color?: string;
  style?: ViewStyle;
  segments?: number;
}

export function PixelProgressBar({ pct, color = C.accent, style, segments = 16 }: Props) {
  const filled = Math.round((pct / 100) * segments);
  return (
    <View style={[styles.track, style]}>
      {Array.from({ length: segments }).map((_, i) => (
        <View
          key={i}
          style={[styles.seg, { backgroundColor: i < filled ? color : C.panelHi }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 2,
    height: 10,
    borderWidth: 1,
    borderColor: C.line,
    padding: 2,
    borderRadius: 2,
    backgroundColor: C.panel,
  },
  seg: {
    flex: 1,
    borderRadius: 1,
  },
});
