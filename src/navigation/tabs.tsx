import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CaptureScreen } from "../screens/CaptureScreen";
import { GarageStack } from "./GarageStack";
import { ContributeScreen } from "../screens/ContributeScreen";
import { MapScreen } from "../screens/MapScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { C } from "../theme/colors";
import { F } from "../theme/type";

const Tab = createBottomTabNavigator();

function tabIcon(label: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ color, fontSize: 18, fontFamily: F.display }}>{label}</Text>
  );
}

export function createBottomTabs() {
  return function BottomTabs() {
    return (
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: C.panel },
          headerTitleStyle: { color: C.text, fontFamily: F.display, fontSize: 10 },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: C.panel,
            borderTopColor: C.line,
            borderTopWidth: 2,
            height: 58,
          },
          tabBarActiveTintColor: C.accent,
          tabBarInactiveTintColor: C.textDim,
          tabBarLabelStyle: { fontFamily: F.body, fontSize: 13, marginBottom: 4 },
        }}
      >
        <Tab.Screen
          name="Hunt"
          component={CaptureScreen}
          options={{ headerShown: false, tabBarIcon: tabIcon("◎") }}
        />
        <Tab.Screen
          name="Garage"
          component={GarageStack}
          options={{ headerShown: false, tabBarIcon: tabIcon("▦") }}
        />
        <Tab.Screen
          name="Add"
          component={ContributeScreen}
          options={{ tabBarIcon: tabIcon("＋") }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{ tabBarIcon: tabIcon("◍") }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarIcon: tabIcon("◐") }}
        />
      </Tab.Navigator>
    );
  };
}
