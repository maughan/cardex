import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  fetchGarage,
  fetchSetProgress,
  type GarageEntry,
  type SetProgress,
} from "../lib/collection";
import { RARITY_LABEL, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthProvider";

export function GarageScreen() {
  const { signOut } = useAuth();
  const [garage, setGarage] = useState<GarageEntry[]>([]);
  const [sets, setSets] = useState<SetProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [g, s] = await Promise.all([fetchGarage(), fetchSetProgress()]);
      setGarage(g);
      setSets(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your garage");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the tab regains focus (e.g. after a catch).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.fill}
      data={garage}
      keyExtractor={(item) => String(item.carId)}
      numColumns={3}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      ListHeaderComponent={
        <View>
          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.sectionTitle}>Sets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.setsRow}>
            {sets.map((s) => (
              <View key={s.setId} style={styles.setCard}>
                <Text style={styles.setName}>{s.name}</Text>
                <Text style={styles.setCount}>{s.caughtCars}/{s.totalCars}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${s.pctComplete}%` }]} />
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.garageHeader}>
            <Text style={styles.sectionTitle}>Garage ({garage.length})</Text>
            <Pressable onPress={signOut}><Text style={styles.signout}>Sign out</Text></Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No catches yet — head to the Hunt tab and bag your first car.</Text>
      }
      renderItem={({ item }) => (
        <View style={[styles.tile, { borderColor: rarityColor(item.rarityTier) }]}>
          {item.spriteUrl
            ? <Image source={{ uri: item.spriteUrl }} style={styles.sprite} resizeMode="contain" />
            : <View style={styles.spritePlaceholder}><Text style={styles.placeholder}>?</Text></View>}
          <Text style={styles.tileLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={[styles.tileRarity, { color: rarityColor(item.rarityTier) }]}>
            {RARITY_LABEL[item.rarityTier]}
          </Text>
          {item.spottedCount > 1 && <Text style={styles.count}>×{item.spottedCount}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0B0C0F" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 12, paddingBottom: 40 },
  row: { gap: 10, marginBottom: 10 },
  error: { color: "#E5534B", fontSize: 14, marginBottom: 12 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 8, marginBottom: 10 },
  setsRow: { marginBottom: 8 },
  setCard: { width: 150, backgroundColor: "#15171C", borderRadius: 12, padding: 12, marginRight: 10 },
  setName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  setCount: { color: "#9AA0A6", fontSize: 12, marginTop: 2, marginBottom: 8 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: "#23262E", overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: "#2F80ED" },
  garageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  signout: { color: "#6B7178", fontSize: 13 },
  empty: { color: "#9AA0A6", fontSize: 14, textAlign: "center", marginTop: 32, paddingHorizontal: 20 },
  tile: { flex: 1 / 3, backgroundColor: "#15171C", borderRadius: 12, borderWidth: 1, padding: 8, alignItems: "center" },
  sprite: { width: "100%", height: 60, marginBottom: 6 },
  spritePlaceholder: { width: "100%", height: 60, borderRadius: 8, backgroundColor: "#23262E", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  placeholder: { color: "#4A4F58", fontSize: 24, fontWeight: "800" },
  tileLabel: { color: "#fff", fontSize: 12, fontWeight: "600", textAlign: "center" },
  tileRarity: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  count: { color: "#9AA0A6", fontSize: 11, marginTop: 2 },
});
