import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabs } from "./tabs";
import { useAuth } from "../context/AuthProvider";
import { AuthScreen } from "../screens/AuthScreen";

const Tabs = createBottomTabs();

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0C0F" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      {session ? <Tabs /> : <AuthScreen />}
    </NavigationContainer>
  );
}
