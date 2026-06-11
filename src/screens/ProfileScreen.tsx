import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  type Achievement,
  fetchAchievements,
  fetchProfileStats,
  fetchShareTrainingImages,
  setShareTrainingImages,
  type ProfileStats,
} from "../lib/collection";
import { RARITY_LABEL, RARITY_ORDER, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthProvider";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "../components/ui/Frame";
import { PixelProgressBar } from "../components/ui/PixelProgressBar";
import { Badge } from "../components/ui/Badge";

const TIER_COLOR: Record<string, string> = {
  bronze: C.orange,
  silver: C.line,
  gold: C.gold,
};

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareImages, setShareImages] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const email = session?.user?.email ?? "TRAINER";
  const handle = email.split("@")[0].toUpperCase();
  const initial = handle.charAt(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, share, ach] = await Promise.all([
        fetchProfileStats(),
        fetchShareTrainingImages(),
        fetchAchievements(),
      ]);
      setStats(s);
      setShareImages(share);
      setAchievements(ach);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onToggleShare = useCallback(async (value: boolean) => {
    setShareImages(value); // optimistic
    setSavingShare(true);
    try {
      await setShareTrainingImages(value);
    } catch (e) {
      setShareImages(!value); // revert on failure
      setError(e instanceof Error ? e.message : "Couldn't update preference");
    } finally {
      setSavingShare(false);
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

      {/* Badges */}
      <Text style={styles.sectionTitle}>BADGES</Text>
      <Frame style={styles.badgesRow}>
        {(() => {
          const contrib = achievements.filter((a) => a.kind === "contributor");
          const tier = ["gold", "silver", "bronze"].find((t) =>
            contrib.some((a) => a.tier === t),
          );
          return (
            <Badge
              label={tier ? `CONTRIBUTOR ${tier.toUpperCase()}` : "CONTRIBUTOR"}
              earned={!!tier}
              color={tier ? TIER_COLOR[tier] : C.gold}
            />
          );
        })()}
        {achievements.length === 0 && (
          <Text style={styles.badgeHint}>
            Add a car under the ＋ tab to earn your first badge.
          </Text>
        )}
      </Frame>

      {/* Settings */}
      <Text style={styles.sectionTitle}>SETTINGS</Text>
      <Frame style={styles.settingRow}>
        <View style={styles.settingText}>
          <Text style={styles.settingLabel}>SHARE CATCH PHOTOS</Text>
          <Text style={styles.settingHint}>
            Help improve recognition. Your confirmed catches are used to train
            the model. Off by default.
          </Text>
        </View>
        <Switch
          value={shareImages}
          onValueChange={onToggleShare}
          disabled={savingShare}
          trackColor={{ false: C.line, true: C.accent }}
          thumbColor={C.text}
        />
      </Frame>

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

  badgesRow: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  badgeHint: { flex: 1, fontFamily: F.body, color: C.textDim, fontSize: 14, lineHeight: 19 },

  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingText: { flex: 1 },
  settingLabel: { fontFamily: F.display, color: C.text, fontSize: 8, letterSpacing: 1 },
  settingHint: { fontFamily: F.body, color: C.textDim, fontSize: 14, marginTop: 4, lineHeight: 19 },

  signout: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  signoutText: { fontFamily: F.display, color: C.red, fontSize: 7, letterSpacing: 1 },
});
