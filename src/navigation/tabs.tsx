import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CaptureScreen } from "../screens/CaptureScreen";
import { GarageScreen } from "../screens/GarageScreen";

const Tab = createBottomTabNavigator();

// Simple text icons keep the shell dependency-free; swap for an icon set later.
function tabIcon(label: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ color, fontSize: 18 }}>{label}</Text>
  );
}

export function createBottomTabs() {
  return function BottomTabs() {
    return (
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#0B0C0F" },
          headerTitleStyle: { color: "#fff" },
          tabBarStyle: { backgroundColor: "#0B0C0F", borderTopColor: "#1E2127" },
          tabBarActiveTintColor: "#2F80ED",
          tabBarInactiveTintColor: "#6B7178",
        }}
      >
        <Tab.Screen
          name="Hunt"
          component={CaptureScreen}
          options={{ headerShown: false, tabBarIcon: tabIcon("◎") }}
        />
        <Tab.Screen
          name="Garage"
          component={GarageScreen}
          options={{ tabBarIcon: tabIcon("▦") }}
        />
      </Tab.Navigator>
    );
  };
}
