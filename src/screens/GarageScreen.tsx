import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  fetchGarage,
  fetchSetProgress,
  type GarageEntry,
  type SetProgress,
} from "../lib/collection";
import type { GarageStackParamList } from "../navigation/types";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { PixelCard } from "../components/ui/PixelCard";
import { PixelProgressBar } from "../components/ui/PixelProgressBar";
import { rarityColor } from "../lib/rarity";

type Nav = NativeStackNavigationProp<GarageStackParamList, "GarageHome">;

export function GarageScreen() {
  const navigation = useNavigation<Nav>();
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
        <ActivityIndicator size="large" color={C.accent} />
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      ListHeaderComponent={
        <View>
          {error && <Text style={styles.error}>{error}</Text>}

          {/* Sets strip */}
          <Text style={styles.sectionTitle}>SETS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.setsRow}>
            {sets.map((s) => (
              <Pressable
                key={s.setId}
                style={styles.setCard}
                onPress={() => navigation.navigate("SetDetail", { slug: s.slug, name: s.name })}
              >
                <Text style={styles.setName} numberOfLines={1}>{s.name.toUpperCase()}</Text>
                <Text style={styles.setCount}>{s.caughtCars}/{s.totalCars}</Text>
                <PixelProgressBar
                  pct={s.pctComplete}
                  color={s.pctComplete === 100 ? C.gold : C.accent}
                  style={styles.setBar}
                />
              </Pressable>
            ))}
          </ScrollView>

          {/* Garage header */}
          <Text style={styles.sectionTitle}>
            GARAGE{" "}
            <Text style={styles.sectionCount}>{garage.length}</Text>
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          NO CATCHES YET{"\n"}HEAD TO HUNT AND BAG YOUR FIRST CAR
        </Text>
      }
      renderItem={({ item, index }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("CarDetail", { carId: item.carId, dexNumber: index + 1 })}
        >
          <PixelCard
            dexNumber={index + 1}
            label={item.label}
            rarityTier={item.rarityTier}
            spriteUrl={item.spriteUrl}
            spottedCount={item.spottedCount}
            style={styles.cardFill}
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 10, paddingBottom: 40 },
  row: { gap: 8, marginBottom: 8 },
  error: { fontFamily: F.body, color: C.red, fontSize: 15, marginBottom: 10 },
  sectionTitle: {
    fontFamily: F.display,
    color: C.text,
    fontSize: 8,
    letterSpacing: 2,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionCount: {
    color: C.textDim,
    fontSize: 7,
  },
  setsRow: { marginBottom: 4 },
  setCard: {
    width: 140,
    backgroundColor: C.panel,
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 2,
    padding: 10,
    marginRight: 8,
    gap: 4,
  },
  setName: {
    fontFamily: F.display,
    color: C.text,
    fontSize: 7,
    letterSpacing: 0.5,
  },
  setCount: {
    fontFamily: F.body,
    color: C.textDim,
    fontSize: 15,
  },
  setBar: { marginTop: 4 },
  empty: {
    fontFamily: F.display,
    color: C.textDim,
    fontSize: 7,
    textAlign: "center",
    marginTop: 32,
    paddingHorizontal: 20,
    lineHeight: 16,
    letterSpacing: 1,
  },
  card: { flex: 1 / 3 },
  cardFill: { width: "100%" },
});
