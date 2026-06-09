import * as Location from "expo-location";

// Location is optional throughout the app: returning null simply skips the
// GPS tag / coherence check, so every path here fails soft.

export interface Coords {
  lat: number;
  lng: number;
}

export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    // Reuse an existing grant; only prompt if undetermined.
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status === "undetermined") {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== "granted") return null;

    // Last-known is near-instant and good enough for tagging a catch; fall
    // back to a fresh fix only if there isn't one, so the reveal isn't delayed
    // by a cold GPS lock.
    const last = await Location.getLastKnownPositionAsync();
    const pos = last ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));

    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
