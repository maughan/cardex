import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Candidate } from "../types";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "./ui/Frame";
import { RarityChip } from "./ui/RarityChip";
import { PixelButton } from "./ui/PixelButton";

interface Props {
  candidates: Candidate[];
  onPick: (c: Candidate) => void;
  onManualSearch: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({ candidates, onPick, onManualSearch, onCancel }: Props) {
  const [focusedIdx, setFocusedIdx] = useState(0);

  return (
    <View style={styles.backdrop}>
      <Frame style={styles.sheet} padded={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>IS THIS YOUR CATCH?</Text>
          <Text style={styles.subtitle}>SELECT THE RIGHT ONE</Text>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {candidates.map((c, i) => (
            <Pressable
              key={c.carId}
              style={[styles.row, i === focusedIdx && styles.rowFocused]}
              onPress={() => { setFocusedIdx(i); onPick(c); }}
              onFocus={() => setFocusedIdx(i)}
            >
              <Text style={[styles.cursor, { opacity: i === focusedIdx ? 1 : 0 }]}>▶</Text>
              <View style={styles.rowText}>
                <Text style={styles.label} numberOfLines={1}>{c.label}</Text>
                <RarityChip tier={c.rarityTier} style={styles.chip} />
              </View>
              <Text style={styles.confidence}>{Math.round(c.confidence * 100)}%</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <PixelButton
            label="SEARCH MANUALLY"
            onPress={onManualSearch}
            variant="ghost"
            size="sm"
            style={styles.actionBtn}
          />
          <PixelButton
            label="CANCEL"
            onPress={onCancel}
            variant="danger"
            size="sm"
            style={styles.actionBtn}
          />
        </View>
      </Frame>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,18,28,0.82)",
    justifyContent: "flex-end",
  },
  sheet: {
    margin: 12,
    marginBottom: 24,
  },
  titleRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  title: {
    fontFamily: F.display,
    fontSize: 9,
    color: C.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.textDim,
    marginTop: 4,
  },
  list: { maxHeight: 280 },
  listContent: { paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: C.panel,
    gap: 8,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowFocused: {
    backgroundColor: C.panelHi,
  },
  cursor: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.accent,
    width: 14,
  },
  rowText: { flex: 1, gap: 4 },
  label: { fontFamily: F.body, color: C.text, fontSize: 20 },
  chip: { alignSelf: "flex-start" },
  confidence: {
    fontFamily: F.display,
    color: C.textDim,
    fontSize: 7,
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  actionBtn: { flex: 1 },
});
