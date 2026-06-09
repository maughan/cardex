import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { type CatalogueCar, searchCars } from "../lib/collection";
import { RARITY_LABEL, rarityColor } from "../lib/rarity";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { RarityChip } from "./ui/RarityChip";

interface Props {
  onPick: (car: CatalogueCar) => void;
  onClose: () => void;
}

export function CatalogueSearch({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogueCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchCars(query);
        if (id === reqId.current) {
          setResults(rows);
          setError(null);
        }
      } catch (e) {
        if (id === reqId.current) {
          setError(e instanceof Error ? e.message : "Search failed");
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const placeholder = useMemo(() => "SEARCH MAKE OR MODEL…", []);

  return (
    <View style={styles.overlay}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>▶ DEX LOOKUP</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕ CANCEL</Text>
          </Pressable>
        </View>
        <View style={styles.inputWrap}>
          <Text style={styles.inputPrefix}>{'>'}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={C.textDim}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading
        ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.accent} />
            <Text style={styles.loadingText}>SEARCHING…</Text>
          </View>
        )
        : (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.carId)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>NO MATCHES FOUND</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onPick(item)}
              >
                <Text style={styles.cursor}>▶</Text>
                <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
                <RarityChip tier={item.rarityTier} />
              </Pressable>
            )}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.lcdBg, paddingTop: 56 },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.line,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    fontFamily: F.display,
    fontSize: 9,
    color: C.accent,
    letterSpacing: 1,
  },
  closeBtn: { paddingVertical: 8 },
  closeText: {
    fontFamily: F.display,
    fontSize: 7,
    color: C.red,
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.panelHi,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 2,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  inputPrefix: {
    fontFamily: F.display,
    fontSize: 10,
    color: C.accent,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: C.text,
    fontFamily: F.body,
    fontSize: 20,
    paddingVertical: 10,
  },
  error: { fontFamily: F.body, color: C.red, fontSize: 16, paddingHorizontal: 16, marginTop: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: F.display, color: C.textDim, fontSize: 7, letterSpacing: 2 },
  list: { padding: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: C.panel,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 2,
    minHeight: 48,
    gap: 8,
  },
  rowPressed: { backgroundColor: C.panelHi },
  cursor: { fontFamily: F.body, fontSize: 16, color: C.accent, width: 14 },
  label: { flex: 1, fontFamily: F.body, color: C.text, fontSize: 20 },
  empty: {
    fontFamily: F.display,
    color: C.textDim,
    fontSize: 8,
    textAlign: "center",
    marginTop: 32,
    letterSpacing: 1,
  },
});
