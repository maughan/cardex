import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface Props {
  reduceMotion?: boolean;
}

// Full-screen scanline overlay — pointerEvents=none so it never blocks touches.
// Static when reduce-motion is on; gentle shimmer otherwise.
export function ScanlineOverlay({ reduceMotion = false }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduceMotion]);

  const opacity = reduceMotion
    ? 0.03
    : shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.025, 0.055] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "#000",
  },
});
