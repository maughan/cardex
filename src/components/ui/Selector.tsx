import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { C } from "../../theme/colors";
import { F } from "../../theme/type";

interface SelectorItem {
  key: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
}

interface Props {
  items: SelectorItem[];
  focusedKey?: string;
  onPress: (key: string) => void;
  style?: ViewStyle;
}

// A Pokemon-style selector list: blinking ▶ cursor marks the focused row.
export function Selector({ items, focusedKey, onPress, style }: Props) {
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  return (
    <View style={[styles.container, style]}>
      {items.map((item) => {
        const focused = item.key === focusedKey;
        return (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.row,
              focused && styles.rowFocused,
              pressed && styles.rowPressed,
            ]}
            onPress={() => onPress(item.key)}
          >
            <Animated.Text
              style={[styles.cursor, { opacity: focused ? blink : 0 }]}
            >
              ▶
            </Animated.Text>
            <View style={styles.rowContent}>
              <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
              {item.sub ? <Text style={styles.sub} numberOfLines={1}>{item.sub}</Text> : null}
            </View>
            {item.right}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 10,
    backgroundColor: C.panel,
    minHeight: 44,
    gap: 8,
  },
  rowFocused: {
    backgroundColor: C.panelHi,
  },
  rowPressed: {
    backgroundColor: C.panelHi,
    opacity: 0.8,
  },
  cursor: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.accent,
    width: 14,
  },
  rowContent: {
    flex: 1,
  },
  label: {
    fontFamily: F.body,
    fontSize: 20,
    color: C.text,
  },
  sub: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.textDim,
    marginTop: 1,
  },
});
