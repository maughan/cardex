// Thin wrapper so the capture flow doesn't depend on a specific geolocation lib.
// Swap the body for @react-native-community/geolocation or expo-location.
// Location is optional: returning null simply skips the GPS coherence check.

export interface Coords {
  lat: number;
  lng: number;
}

export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    // Example (expo-location):
    //   const { status } = await Location.requestForegroundPermissionsAsync();
    //   if (status !== "granted") return null;
    //   const pos = await Location.getCurrentPositionAsync({});
    //   return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    return null;
  } catch {
    return null;
  }
}
