import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GarageScreen } from "../screens/GarageScreen";
import { SetDetailScreen } from "../screens/SetDetailScreen";
import { CarDetailScreen } from "../screens/CarDetailScreen";
import type { GarageStackParamList } from "./types";

const Stack = createNativeStackNavigator<GarageStackParamList>();

export function GarageStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0B0C0F" },
        headerTitleStyle: { color: "#fff" },
        headerTintColor: "#2F80ED",
        contentStyle: { backgroundColor: "#0B0C0F" },
      }}
    >
      <Stack.Screen
        name="GarageHome"
        component={GarageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SetDetail"
        component={SetDetailScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <Stack.Screen
        name="CarDetail"
        component={CarDetailScreen}
        options={{ title: "DEX ENTRY", headerShown: false }}
      />
    </Stack.Navigator>
  );
}
