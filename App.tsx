import React, { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts, PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { AuthProvider } from "./src/context/AuthProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ScanlineOverlay } from "./src/components/ui/ScanlineOverlay";
import { C } from "./src/theme/colors";

export default function App() {
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
    VT323_400Regular,
  });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <Text style={styles.bootLogo}>CARDEX</Text>
        <Text style={styles.bootSub}>LOADING…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <RootNavigator reduceMotion={reduceMotion} />
        </AuthProvider>
        <ScanlineOverlay reduceMotion={reduceMotion} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.lcdBg },
  boot: {
    flex: 1,
    backgroundColor: C.lcdBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  bootLogo: {
    fontSize: 22,
    color: C.accent,
    letterSpacing: 4,
    fontWeight: "800",
  },
  bootSub: {
    fontSize: 12,
    color: C.textDim,
    letterSpacing: 2,
  },
});
