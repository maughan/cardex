import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchCarDetail, type CarDetail } from "../lib/collection";
import type { GarageStackParamList } from "../navigation/types";
import { RARITY_LABEL, rarityColor } from "../lib/rarity";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "../components/ui/Frame";

type Props = NativeStackScreenProps<GarageStackParamList, "CarDetail">;

function isRealSprite(url: string | null): boolean {
  return !!url && !url.includes("/placeholder/");
}

function yearText(d: CarDetail): string {
  if (d.productionYears?.trim()) return d.productionYears.trim();
  if (d.yearStart) {
    return `${d.yearStart}${d.yearEnd && d.yearEnd !== d.yearStart ? `–${d.yearEnd}` : ""}`;
  }
  return "—";
}

export function CarDetailScreen({ route }: Props) {
  const { carId, dexNumber } = route.params;
  const navigation = useNavigation();
  const [car, setCar] = useState<CarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCar(await fetchCarDetail(carId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this entry");
    } finally {
      setLoading(false);
    }
  }, [carId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }
  if (error || !car) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.errorText}>{error ?? "Not found"}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>◀ BACK</Text>
        </Pressable>
      </View>
    );
  }

  const accent = car.caught ? rarityColor(car.rarityTier) : C.line;
  const dexNo = dexNumber != null ? String(dexNumber).padStart(3, "0") : "—";
  const name = car.caught ? `${car.make} ${car.model}` : "???";

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>◀</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DEX ENTRY</Text>
        <Text style={styles.dexNo}>No.{dexNo}</Text>
      </View>

      {/* Sprite + identity */}
      <Frame style={[styles.topCard, { borderColor: accent }]}>
        <View style={[styles.spriteBox, { borderColor: accent }]}>
          {isRealSprite(car.spriteUrl) && car.caught
            ? <Image source={{ uri: car.spriteUrl! }} style={styles.sprite} resizeMode="contain" />
            : <Text style={[styles.silhouette, { color: car.caught ? C.textDim : C.panelHi }]}>?</Text>}
        </View>
        <View style={styles.identity}>
          <View style={[styles.ribbon, { backgroundColor: accent }]}>
            <Text style={styles.ribbonText}>
              {car.caught ? RARITY_LABEL[car.rarityTier].toUpperCase() : "UNDISCOVERED"}
            </Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          <Text style={styles.category}>
            {car.caught ? (car.segment || "VEHICLE").toUpperCase() : "???"}
          </Text>
          <Text style={styles.years}>{car.caught ? yearText(car) : "????"}</Text>
        </View>
      </Frame>

      {!car.caught ? (
        <Frame style={styles.lockedCard}>
          <Text style={styles.lockedText}>
            NOT YET CAUGHT.{"\n"}Spot this one in the wild to unlock its Dex entry.
          </Text>
        </Frame>
      ) : (
        <>
          {/* Data panel */}
          <Frame padded={false} style={styles.dataPanel}>
            <DataRow label="MAKE" value={car.make} />
            <DataRow label="MODEL" value={car.model} />
            {car.generation ? <DataRow label="GEN" value={car.generation} /> : null}
            {car.variant ? <DataRow label="VARIANT" value={car.variant} /> : null}
            <DataRow label="BODY" value={(car.body || "—").toUpperCase()} />
            {car.segment ? <DataRow label="SEGMENT" value={car.segment} /> : null}
            <DataRow label="YEARS" value={yearText(car)} />
            {car.engine ? <DataRow label="ENGINE" value={car.engine} /> : null}
            <DataRow label="RARITY" value={RARITY_LABEL[car.rarityTier].toUpperCase()} valueColor={accent} last />
          </Frame>

          {/* Pokédex flavor text */}
          {car.description ? (
            <Frame style={styles.descBox}>
              <Text
                style={styles.descText}
                numberOfLines={descExpanded ? undefined : 5}
              >
                {car.description}
              </Text>
              {car.description.length > 220 && (
                <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={8}>
                  <Text style={styles.readMore}>
                    {descExpanded ? "SHOW LESS ▲" : "READ MORE ▼"}
                  </Text>
                </Pressable>
              )}
            </Frame>
          ) : null}

          {/* Catch record */}
          <Frame style={styles.catchCard}>
            <Text style={styles.catchTitle}>YOUR RECORD</Text>
            <DataRow label="SIGHTINGS" value={`×${car.spottedCount}`} />
            {car.firstCaughtAt ? (
              <DataRow label="FIRST" value={new Date(car.firstCaughtAt).toLocaleDateString()} />
            ) : null}
            {car.lastCaughtAt ? (
              <DataRow label="LATEST" value={new Date(car.lastCaughtAt).toLocaleDateString()} last />
            ) : null}
          </Frame>
        </>
      )}
    </ScrollView>
  );
}

function DataRow({
  label, value, valueColor, last,
}: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  content: { padding: 14, paddingBottom: 40, gap: 12 },
  errorText: { fontFamily: F.body, color: C.red, fontSize: 16, textAlign: "center" },
  backLink: { paddingVertical: 10 },
  backLinkText: { fontFamily: F.display, color: C.accent, fontSize: 9, letterSpacing: 1 },

  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  back: { fontFamily: F.display, color: C.accent, fontSize: 14 },
  headerTitle: { fontFamily: F.display, color: C.text, fontSize: 10, letterSpacing: 2 },
  dexNo: { fontFamily: F.body, color: C.textDim, fontSize: 16 },

  topCard: { flexDirection: "row", gap: 12, alignItems: "center" },
  spriteBox: {
    width: 110, height: 110, borderWidth: 2, borderRadius: 2,
    backgroundColor: C.ink, alignItems: "center", justifyContent: "center",
  },
  sprite: { width: "100%", height: "100%" },
  silhouette: { fontSize: 54, fontFamily: F.display },
  identity: { flex: 1, gap: 6 },
  ribbon: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2 },
  ribbonText: { fontFamily: F.display, fontSize: 6, color: C.ink, letterSpacing: 0.5 },
  name: { fontFamily: F.display, fontSize: 12, color: C.text, letterSpacing: 0.5, lineHeight: 18 },
  category: { fontFamily: F.body, fontSize: 16, color: C.textDim },
  years: { fontFamily: F.body, fontSize: 15, color: C.textDim },

  lockedCard: { },
  lockedText: { fontFamily: F.body, color: C.textDim, fontSize: 17, textAlign: "center", lineHeight: 24 },

  dataPanel: { },
  row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel: { fontFamily: F.display, fontSize: 7, color: C.textDim, letterSpacing: 1, width: 76, paddingTop: 2 },
  rowValue: { flex: 1, fontFamily: F.body, fontSize: 17, color: C.text },

  descBox: { gap: 8 },
  descText: { fontFamily: F.body, fontSize: 16, color: C.text, lineHeight: 23 },
  readMore: { fontFamily: F.display, fontSize: 7, color: C.accent, letterSpacing: 1 },

  catchCard: { gap: 2 },
  catchTitle: { fontFamily: F.display, fontSize: 8, color: C.accent, letterSpacing: 1, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6 },
});
