import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { ViewStyle } from "react-native";
import { C } from "../../theme/colors";
import { F } from "../../theme/type";

type Variant = "primary" | "confirm" | "danger" | "ghost";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  size?: "sm" | "md";
}

const BG: Record<Variant, string> = {
  primary: C.accent,
  confirm: C.green,
  danger: C.red,
  ghost: "transparent",
};

const BORDER: Record<Variant, string> = {
  primary: C.accent,
  confirm: C.green,
  danger: C.red,
  ghost: C.line,
};

export function PixelButton({ label, onPress, variant = "primary", disabled, style, size = "md" }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: BG[variant], borderColor: BORDER[variant] },
        size === "sm" && styles.btnSm,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, size === "sm" && styles.labelSm, variant === "ghost" && styles.ghostLabel]}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 2,
    borderRadius: 2,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    // Bottom-right shadow for bevel depth
    shadowColor: C.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 0,
    elevation: 3,
  },
  btnSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  pressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 0, height: 0 },
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: F.display,
    fontSize: 9,
    color: C.ink,
    letterSpacing: 0.5,
  },
  labelSm: {
    fontSize: 7,
  },
  ghostLabel: {
    color: C.text,
  },
});
