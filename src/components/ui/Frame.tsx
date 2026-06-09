import React from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { C } from "../../theme/colors";

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

// 9-slice bevel: light top-left edge, dark bottom-right edge — classic dialog box look.
export function Frame({ children, style, padded = true }: Props) {
  return (
    <View style={[styles.outer, style]}>
      <View style={styles.inner}>
        {/* top-left bevel highlight */}
        <View style={styles.bevelTL} />
        {/* bottom-right bevel shadow */}
        <View style={styles.bevelBR} />
        <View style={[styles.content, padded && styles.padding]}>
          {children}
        </View>
      </View>
    </View>
  );
}

// Flat panel variant without bevel — for inner panels inside a Frame.
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panel, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 4,
    backgroundColor: C.panel,
    overflow: "hidden",
  },
  inner: {
    position: "relative",
  },
  bevelTL: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: C.shellHi,
    zIndex: 1,
  },
  bevelBR: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: C.ink,
    zIndex: 1,
  },
  content: { },
  padding: { padding: 12 },
  panel: {
    backgroundColor: C.panelHi,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: C.line,
    padding: 10,
  },
});
