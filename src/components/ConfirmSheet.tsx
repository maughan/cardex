import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Candidate } from "../types";
import { RARITY_LABEL, rarityColor } from "../lib/rarity";

interface Props {
  candidates: Candidate[];
  onPick: (c: Candidate) => void;
  onManualSearch: () => void;
  onCancel: () => void;
}

// Bottom sheet shown after recognition: the model proposes, the user confirms
// or corrects. The top candidate is highlighted; a manual-search escape hatch
// is always available.
export function ConfirmSheet({ candidates, onPick, onManualSearch, onCancel }: Props) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Is this your catch?</Text>
        <Text style={styles.subtitle}>Pick the right one, or search manually.</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {candidates.map((c, i) => (
            <Pressable
              key={c.carId}
              style={[styles.row, i === 0 && styles.rowTop]}
              onPress={() => onPick(c)}
            >
              <View style={[styles.dot, { backgroundColor: rarityColor(c.rarityTier) }]} />
              <View style={styles.rowText}>
                <Text style={styles.label}>{c.label}</Text>
                <Text style={[styles.rarity, { color: rarityColor(c.rarityTier) }]}>
                  {RARITY_LABEL[c.rarityTier]}
                </Text>
              </View>
              <Text style={styles.confidence}>{Math.round(c.confidence * 100)}%</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.manual} onPress={onManualSearch}>
          <Text style={styles.manualText}>None of these — search manually</Text>
        </Pressable>
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#15171C", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#3A3F47", marginBottom: 14 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#9AA0A6", fontSize: 13, marginTop: 2, marginBottom: 12 },
  list: { maxHeight: 320 },
  listContent: { paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#1E2127", marginBottom: 8 },
  rowTop: { borderWidth: 1, borderColor: "#2F80ED" },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowText: { flex: 1 },
  label: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rarity: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  confidence: { color: "#9AA0A6", fontSize: 14, fontVariant: ["tabular-nums"] },
  manual: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  manualText: { color: "#2F80ED", fontSize: 15, fontWeight: "600" },
  cancel: { paddingVertical: 8, alignItems: "center" },
  cancelText: { color: "#6B7178", fontSize: 14 },
});
