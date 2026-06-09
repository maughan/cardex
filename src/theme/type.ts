import type { TextStyle } from "react-native";

export const F = {
  display: "PressStart2P_400Regular" as const,
  body: "VT323_400Regular" as const,
};

export function displayText(size: number): TextStyle {
  return { fontFamily: F.display, fontSize: size, letterSpacing: 0.5 };
}

export function bodyText(size: number): TextStyle {
  return { fontFamily: F.body, fontSize: size };
}
