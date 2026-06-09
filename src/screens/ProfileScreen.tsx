import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchProfileStats, type ProfileStats } from "../lib/collection";
import { RARITY_LABEL, RARITY_ORDER, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthProvider";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "../components/ui/Frame";
import { PixelProgressBar } from "../components/ui/PixelProgressBar";

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email ?? "TRAINER";
  const handle = email.split("@")[0].toUpperCase();
  const initial = handle.charAt(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await fetchProfileStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* Trainer card header */}
      <Frame style={styles.trainerCard}>
        <View style={styles.trainerHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.trainerInfo}>
            <Text style={styles.trainerLabel}>TRAINER</Text>
            <Text style={styles.handle}>{handle}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>

        {stats && (
          <PixelProgressBar
            pct={stats.completionPct}
            color={stats.completionPct === 100 ? C.gold : C.accent}
            style={styles.completionBar}
          />
        )}
        {stats && (
          <Text style={styles.completionLabel}>
            DEX {stats.completionPct}% COMPLETE
          </Text>
        )}
      </Frame>

      {error && <Text style={styles.error}>{error}</Text>}

      {stats && (
        <>
          {/* Stat tiles */}
          <View style={styles.statGrid}>
            <StatTile label="CAUGHT" value={`${stats.totalCaught}/${stats.catalogueSize}`} />
            <StatTile label="SCORE" value={String(stats.rarityScore)} />
            <StatTile label="SIGHTINGS" value={String(stats.totalSightings)} />
            <StatTile label="SETS" value={`${stats.setsCompleted}/${stats.setsTotal}`} />
          </View>

          {/* Rarity breakdown */}
          <Text style={styles.sectionTitle}>RARITY BREAKDOWN</Text>
          <Frame padded={false} style={styles.breakdownFrame}>
            {RARITY_ORDER.map((tier, i) => (
              <View
                key={tier}
                style={[
                  styles.breakRow,
                  i < RARITY_ORDER.length - 1 && styles.breakRowBorder,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: rarityColor(tier) }]} />
                <Text style={styles.breakLabel}>{RARITY_LABEL[tier].toUpperCase()}</Text>
                <Text style={styles.breakCount}>{stats.rarityCounts[tier]}</Text>
              </View>
            ))}
          </Frame>

          {/* Rarest find showcase */}
          <Text style={styles.sectionTitle}>RAREST FIND</Text>
          {stats.rarest
            ? (
              <Frame style={[styles.rarestCard, { borderColor: rarityColor(stats.rarest.rarityTier) }]}>
                <Text style={styles.rarestLabel}>{stats.rarest.label.toUpperCase()}</Text>
                <Text style={[styles.rarestTier, { color: rarityColor(stats.rarest.rarityTier) }]}>
                  ★ {RARITY_LABEL[stats.rarest.rarityTier].toUpperCase()}
                </Text>
              </Frame>
            )
            : <Text style={styles.muted}>NO CATCHES YET — GO HUNT ONE.</Text>}
        </>
      )}

      <Pressable style={styles.signout} onPress={signOut}>
        <Text style={styles.signoutText}>SIGN OUT</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 14, paddingBottom: 40, gap: 14 },

  trainerCard: { },
  trainerHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 2,
    backgroundColor: C.panelHi,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: F.display, color: C.accent, fontSize: 22 },
  trainerInfo: { flex: 1, gap: 2 },
  trainerLabel: { fontFamily: F.display, color: C.textDim, fontSize: 6, letterSpacing: 1 },
  handle: { fontFamily: F.display, color: C.text, fontSize: 11, letterSpacing: 1 },
  email: { fontFamily: F.body, color: C.textDim, fontSize: 14 },
  completionBar: { marginBottom: 4 },
  completionLabel: { fontFamily: F.display, color: C.textDim, fontSize: 6, letterSpacing: 1 },

  error: { fontFamily: F.body, color: C.red, fontSize: 15 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.panel,
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 2,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontFamily: F.display, color: C.text, fontSize: 14 },
  statLabel: { fontFamily: F.body, color: C.textDim, fontSize: 14, letterSpacing: 0.5 },

  sectionTitle: {
    fontFamily: F.display,
    color: C.text,
    fontSize: 8,
    letterSpacing: 2,
  },

  breakdownFrame: { },
  breakRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, gap: 10 },
  breakRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  dot: { width: 8, height: 8, borderRadius: 1 },
  breakLabel: { flex: 1, fontFamily: F.body, color: C.text, fontSize: 18 },
  breakCount: { fontFamily: F.display, color: C.text, fontSize: 9 },

  rarestCard: { borderWidth: 2, gap: 6 },
  rarestLabel: { fontFamily: F.display, color: C.text, fontSize: 9, letterSpacing: 0.5 },
  rarestTier: { fontFamily: F.display, fontSize: 7, letterSpacing: 1 },

  muted: { fontFamily: F.body, color: C.textDim, fontSize: 16 },

  signout: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  signoutText: { fontFamily: F.display, color: C.red, fontSize: 7, letterSpacing: 1 },
});
