import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchSetCars, type SetCarEntry } from "../lib/collection";
import type { GarageStackParamList } from "../navigation/types";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { PixelCard } from "../components/ui/PixelCard";
import { PixelProgressBar } from "../components/ui/PixelProgressBar";
import { Badge } from "../components/ui/Badge";
import { rarityColor } from "../lib/rarity";

type Props = NativeStackScreenProps<GarageStackParamList, "SetDetail">;

export function SetDetailScreen({ route, navigation }: Props) {
  const { slug, name } = route.params;
  const [cars, setCars] = useState<SetCarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCars(await fetchSetCars(slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this set");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const caught = cars.filter((c) => c.caught).length;
  const total = cars.length;
  const pct = total > 0 ? Math.round((caught / total) * 100) : 0;
  const complete = pct === 100;

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
      data={cars}
      keyExtractor={(item) => String(item.carId)}
      numColumns={3}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={C.accent}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.headerTop}>
            <View style={styles.progressBlock}>
              <Text style={styles.progressLabel}>
                {caught} / {total} CAUGHT · {pct}%
              </Text>
              <PixelProgressBar
                pct={pct}
                color={complete ? C.gold : C.accent}
                style={styles.bar}
              />
            </View>
            <Badge
              label={name}
              earned={complete}
              color={C.gold}
              style={styles.badge}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("CarDetail", { carId: item.carId })}
        >
          <PixelCard
            label={item.label}
            rarityTier={item.rarityTier}
            spriteUrl={item.spriteUrl}
            locked={!item.caught}
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
  header: { marginBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressBlock: { flex: 1, gap: 6 },
  progressLabel: {
    fontFamily: F.display,
    color: C.text,
    fontSize: 7,
    letterSpacing: 1,
  },
  bar: { },
  badge: { width: 72 },
  error: { fontFamily: F.body, color: C.red, fontSize: 15, marginBottom: 8 },
  card: { flex: 1 / 3 },
  cardFill: { width: "100%" },
});
