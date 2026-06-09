import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import type { Theme } from "@react-navigation/native";
import { createBottomTabs } from "./tabs";
import { useAuth } from "../context/AuthProvider";
import { AuthScreen } from "../screens/AuthScreen";
import { C } from "../theme/colors";

const Tabs = createBottomTabs();

const LcdTheme: Theme = {
  dark: true,
  colors: {
    primary: C.accent,
    background: C.lcdBg,
    card: C.panel,
    text: C.text,
    border: C.line,
    notification: C.red,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "900" },
  },
};

interface Props {
  reduceMotion?: boolean;
}

export function RootNavigator({ reduceMotion = false }: Props) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.lcdBg }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={LcdTheme}>
      {session ? <Tabs /> : <AuthScreen />}
    </NavigationContainer>
  );
}
