import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { C } from "../../theme/colors";
import { F } from "../../theme/type";

interface Props {
  label: string;
  earned?: boolean;
  color?: string;
  style?: ViewStyle;
}

// Set medal: colored pixel medal when earned, grey silhouette when locked.
export function Badge({ label, earned = false, color = C.gold, style }: Props) {
  const tintColor = earned ? color : C.line;
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.medal, { borderColor: tintColor, backgroundColor: earned ? tintColor + "22" : C.panel }]}>
        <Text style={[styles.icon, { color: tintColor }]}>★</Text>
      </View>
      <Text style={[styles.label, { color: earned ? C.text : C.textDim }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: 64,
  },
  medal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontFamily: F.body,
    fontSize: 13,
    textAlign: "center",
  },
});
