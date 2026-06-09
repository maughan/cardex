import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { type CatchLocation, fetchCatchLocations } from "../lib/collection";
import { RARITY_LABEL, rarityColor } from "../lib/rarity";
import { C } from "../theme/colors";
import { F } from "../theme/type";

const isExpoGo = Constants.executionEnvironment === "storeClient";

export function MapScreen() {
  const [spots, setSpots] = useState<CatchLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSpots(await fetchCatchLocations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your map");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const region = useMemo(() => {
    if (spots.length === 0) return undefined;
    const lats = spots.map((s) => s.lat);
    const lngs = spots.map((s) => s.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.4),
    };
  }, [spots]);

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Expo Go fallback — list styled as a dialog menu
  if (isExpoGo || !MapView) {
    return (
      <View style={styles.fill}>
        <View style={styles.fallbackHeader}>
          <Text style={styles.fallbackTitle}>▶ CATCH LOCATIONS</Text>
          <Text style={styles.fallbackSub}>MAP REQUIRES DEV CLIENT</Text>
        </View>
        <FlatList
          data={spots}
          keyExtractor={(item, i) => `${item.carId}-${i}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>NO GPS-TAGGED CATCHES YET</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.listRow}>
              <View style={[styles.pin, { backgroundColor: rarityColor(item.rarityTier) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.listCoord}>
                  {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                </Text>
              </View>
              <Text style={[styles.listRarity, { color: rarityColor(item.rarityTier) }]}>
                {RARITY_LABEL[item.rarityTier].toUpperCase()}
              </Text>
            </View>
          )}
        />
      </View>
    );
  }

  if (spots.length === 0) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.empty}>NO GPS-TAGGED CATCHES YET</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
      >
        {spots.map((s, i) => (
          <Marker
            key={`${s.carId}-${i}`}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.label}
            description={RARITY_LABEL[s.rarityTier]}
            pinColor={rarityColor(s.rarityTier)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontFamily: F.body, color: C.red, fontSize: 16, textAlign: "center" },
  fallbackHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.line,
  },
  fallbackTitle: {
    fontFamily: F.display,
    fontSize: 9,
    color: C.accent,
    letterSpacing: 1,
  },
  fallbackSub: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 14,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  list: { padding: 14 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 6,
    gap: 10,
    minHeight: 48,
  },
  pin: { width: 10, height: 10, borderRadius: 1 },
  listLabel: { fontFamily: F.body, color: C.text, fontSize: 18 },
  listCoord: { fontFamily: F.body, color: C.textDim, fontSize: 14, marginTop: 1 },
  listRarity: { fontFamily: F.display, fontSize: 6, letterSpacing: 0.5 },
  empty: {
    fontFamily: F.display,
    color: C.textDim,
    fontSize: 7,
    textAlign: "center",
    letterSpacing: 1,
    lineHeight: 16,
  },
});
