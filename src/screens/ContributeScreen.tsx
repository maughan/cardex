import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  fetchMakes,
  fetchSimilarCars,
  searchCars,
  type CatalogueCar,
  type SimilarCar,
} from "../lib/collection";
import { submitCar, uploadSubmissionImages } from "../lib/api";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "../components/ui/Frame";
import { PixelButton } from "../components/ui/PixelButton";

const BODY_TYPES = [
  "hatchback", "sedan", "coupe", "suv", "truck",
  "van", "wagon", "convertible", "sports", "other",
];
const MIN_PHOTOS = 3;
const TARGET_PHOTOS = 20;
// Suggested angles, shown as a rotating prompt to encourage variety.
const ANGLE_GUIDE = [
  "FRONT 3/4", "SIDE PROFILE", "REAR 3/4", "FRONT", "REAR",
  "INTERIOR", "WHEELS / DETAIL", "BADGE / GRILLE",
];

type Step = "search" | "details" | "dupes" | "photos" | "submitting" | "done";

export function ContributeScreen() {
  const [step, setStep] = useState<Step>("search");

  // search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogueCar[]>([]);
  const [searching, setSearching] = useState(false);

  // details
  const [makes, setMakes] = useState<string[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [body, setBody] = useState("other");

  // dedupe
  const [dupes, setDupes] = useState<SimilarCar[]>([]);
  const [checking, setChecking] = useState(false);

  // photos
  const [photos, setPhotos] = useState<string[]>([]);

  // submit
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);

  useEffect(() => { fetchMakes().then(setMakes).catch(() => {}); }, []);

  const runSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await searchCars(q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStep("search");
    setQuery(""); setResults([]);
    setMake(""); setModel(""); setYearStart(""); setYearEnd(""); setBody("other");
    setPhotos([]); setError(null); setSubmissionId(null);
    setDupes([]); setChecking(false);
  }, []);

  const detailsValid = make.trim().length > 0 && model.trim().length > 0;

  // Leaving details → tasteful dedupe: if make+model already match cars, show
  // them first. Never blocks (years/variants differ); just informs.
  const onDetailsNext = useCallback(async () => {
    setChecking(true);
    try {
      const similar = await fetchSimilarCars(make, model);
      if (similar.length > 0) {
        setDupes(similar);
        setStep("dupes");
      } else {
        setStep("photos");
      }
    } catch {
      setStep("photos"); // dedupe is best-effort — never trap the user
    } finally {
      setChecking(false);
    }
  }, [make, model]);

  const onSubmit = useCallback(async () => {
    setStep("submitting");
    setError(null);
    try {
      const paths = await uploadSubmissionImages(photos);
      const res = await submitCar({
        make: make.trim(),
        model: model.trim(),
        yearStart: yearStart ? Number(yearStart) : undefined,
        yearEnd: yearEnd ? Number(yearEnd) : undefined,
        body,
        imagePaths: paths,
      });
      setSubmissionId(res.submissionId);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
      setStep("photos");
    }
  }, [photos, make, model, yearStart, yearEnd, body]);

  if (step === "submitting") {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.statusText}>UPLOADING {photos.length} PHOTOS…</Text>
      </View>
    );
  }

  if (step === "done") {
    return (
      <View style={[styles.fill, styles.center]}>
        <Frame style={styles.doneCard}>
          <Text style={styles.doneTitle}>SUBMITTED!</Text>
          <Text style={styles.doneText}>
            {make.toUpperCase()} {model.toUpperCase()} is pending review. Once
            approved it joins the Dex and trains the model. Thanks for
            contributing — your badge unlocks on approval.
          </Text>
          <PixelButton label="ADD ANOTHER" onPress={reset} style={styles.fullBtn} />
        </Frame>
      </View>
    );
  }

  if (step === "dupes") {
    return (
      <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>ALREADY IN THE DEX?</Text>
        <Text style={styles.hint}>
          We found {dupes.length === 1 ? "a car" : "cars"} matching{" "}
          {make.trim()} {model.trim()}. If yours is one of these, no need to add it —
          go hunt it. If it's a different year, variant or generation, carry on.
        </Text>
        {dupes.map((d) => (
          <View key={d.carId} style={styles.resultRow}>
            <Text style={styles.resultLabel} numberOfLines={1}>{d.label}</Text>
            <Text style={styles.resultYears}>
              {d.productionYears?.trim()
                || `${d.yearStart ?? "?"}${d.yearEnd && d.yearEnd !== d.yearStart ? `–${d.yearEnd}` : ""}`}
            </Text>
          </View>
        ))}
        <View style={styles.navRow}>
          <PixelButton label="EDIT DETAILS" variant="ghost" onPress={() => setStep("details")} style={styles.flexBtn} />
          <PixelButton label="MINE'S DIFFERENT" onPress={() => setStep("photos")} style={styles.flexBtn} />
        </View>
      </ScrollView>
    );
  }

  if (step === "photos") {
    return (
      <PhotoStep
        photos={photos}
        onAdd={(p) => setPhotos((cur) => [...cur, p])}
        onRemove={(i) => setPhotos((cur) => cur.filter((_, idx) => idx !== i))}
        onBack={() => setStep("details")}
        onSubmit={onSubmit}
        error={error}
      />
    );
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      {step === "search" && (
        <>
          <Text style={styles.h1}>ADD A CAR</Text>
          <Text style={styles.hint}>
            First, check it isn't already in the Dex. Search make or model.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Toyota GR Yaris"
            placeholderTextColor={C.textDim}
            value={query}
            onChangeText={runSearch}
            autoCapitalize="words"
          />
          {searching && <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />}
          {results.map((r) => {
            // Prefer the meaningful production_years string; fall back to the
            // parsed year range only if it's missing.
            const years = r.productionYears?.trim()
              || (r.yearStart
                ? `${r.yearStart}${r.yearEnd && r.yearEnd !== r.yearStart ? `–${r.yearEnd}` : ""}`
                : null);
            const meta = [years, r.body ? r.body.toUpperCase() : null]
              .filter(Boolean)
              .join("  ·  ");
            return (
              <View key={r.carId} style={styles.resultRow}>
                <View style={styles.resultMain}>
                  <Text style={styles.resultLabel} numberOfLines={1}>{r.label}</Text>
                  {meta.length > 0 && <Text style={styles.resultMeta}>{meta}</Text>}
                </View>
                <Text style={styles.resultTag}>IN DEX</Text>
              </View>
            );
          })}
          {query.trim().length >= 2 && !searching && (
            <View style={styles.notFound}>
              <Text style={styles.notFoundText}>
                {results.length === 0 ? "Nothing matches." : "Not the one?"} Add it
                as a new car.
              </Text>
              <PixelButton
                label="ADD NEW CAR"
                onPress={() => {
                  // Prefill make from the query's first word if it matches a make.
                  setStep("details");
                }}
                style={styles.fullBtn}
              />
            </View>
          )}
        </>
      )}

      {step === "details" && (
        <>
          <Text style={styles.h1}>CAR DETAILS</Text>

          <Text style={styles.fieldLabel}>MAKE</Text>
          <TextInput
            style={styles.input}
            placeholder="Make"
            placeholderTextColor={C.textDim}
            value={make}
            onChangeText={setMake}
            autoCapitalize="words"
          />
          {make.trim().length > 0 && (
            <View style={styles.chips}>
              {makes
                .filter((m) => m.toLowerCase().startsWith(make.toLowerCase()) && m !== make)
                .slice(0, 6)
                .map((m) => (
                  <Pressable key={m} style={styles.chip} onPress={() => setMake(m)}>
                    <Text style={styles.chipText}>{m}</Text>
                  </Pressable>
                ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>MODEL</Text>
          <TextInput
            style={styles.input}
            placeholder="Model"
            placeholderTextColor={C.textDim}
            value={model}
            onChangeText={setModel}
            autoCapitalize="words"
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>YEAR FROM</Text>
              <TextInput
                style={styles.input}
                placeholder="1990"
                placeholderTextColor={C.textDim}
                value={yearStart}
                onChangeText={setYearStart}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>YEAR TO</Text>
              <TextInput
                style={styles.input}
                placeholder="1999"
                placeholderTextColor={C.textDim}
                value={yearEnd}
                onChangeText={setYearEnd}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>BODY TYPE</Text>
          <View style={styles.chips}>
            {BODY_TYPES.map((b) => (
              <Pressable
                key={b}
                style={[styles.chip, body === b && styles.chipActive]}
                onPress={() => setBody(b)}
              >
                <Text style={[styles.chipText, body === b && styles.chipTextActive]}>
                  {b.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.navRow}>
            <PixelButton label="BACK" variant="ghost" onPress={() => setStep("search")} style={styles.flexBtn} />
            <PixelButton
              label={checking ? "CHECKING…" : "NEXT: PHOTOS"}
              onPress={onDetailsNext}
              disabled={!detailsValid || checking}
              style={styles.flexBtn}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

// --- Photo capture step ------------------------------------------------------

function PhotoStep({
  photos, onAdd, onRemove, onBack, onSubmit, error,
}: {
  photos: string[];
  onAdd: (path: string) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const [shooting, setShooting] = useState(false);
  const angle = ANGLE_GUIDE[photos.length % ANGLE_GUIDE.length];

  useEffect(() => { if (!hasPermission) requestPermission(); }, [hasPermission, requestPermission]);

  const shoot = useCallback(async () => {
    if (!camera.current || shooting) return;
    setShooting(true);
    try {
      const photo = await camera.current.takePhoto({ flash: "off" });
      onAdd(photo.path);
    } catch {
      // ignore — user can retry
    } finally {
      setShooting(false);
    }
  }, [shooting, onAdd]);

  const enough = photos.length >= MIN_PHOTOS;

  if (!hasPermission || device == null) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Frame style={styles.doneCard}>
          <Text style={styles.doneTitle}>CAMERA NEEDED</Text>
          <Text style={styles.doneText}>
            {device == null
              ? "Camera unavailable here (use the dev client, not Expo Go)."
              : "Grant camera access to photograph the car."}
          </Text>
          {device != null && (
            <PixelButton label="GRANT ACCESS" onPress={requestPermission} style={styles.fullBtn} />
          )}
          <PixelButton label="BACK" variant="ghost" onPress={onBack} style={styles.fullBtn} />
        </Frame>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Camera
        ref={camera}
        style={styles.cameraTop}
        device={device}
        isActive={true}
        photo
      />
      <View style={styles.guideBanner} pointerEvents="none">
        <Text style={styles.guideAngle}>SHOT {photos.length + 1}: {angle}</Text>
        <Text style={styles.guideCount}>
          {photos.length}/{TARGET_PHOTOS} · MIN {MIN_PHOTOS}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.captureBtn, pressed && styles.capturePressed]}
        onPress={shoot}
        disabled={shooting}
      >
        <View style={styles.captureInner} />
      </Pressable>

      <View style={styles.photoTray}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <FlatList
          horizontal
          data={photos}
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trayContent}
          ListEmptyComponent={
            <Text style={styles.trayEmpty}>NO PHOTOS YET — SNAP THE CAR FROM A FEW ANGLES</Text>
          }
          renderItem={({ item, index }) => (
            <Pressable onPress={() => onRemove(index)} style={styles.thumbWrap}>
              <Image source={{ uri: item.startsWith("file://") ? item : `file://${item}` }} style={styles.thumb} />
              <View style={styles.thumbX}><Text style={styles.thumbXText}>✕</Text></View>
            </Pressable>
          )}
        />
        <View style={styles.navRow}>
          <PixelButton label="BACK" variant="ghost" onPress={onBack} style={styles.flexBtn} />
          <PixelButton
            label={enough ? `SUBMIT (${photos.length})` : `NEED ${MIN_PHOTOS - photos.length} MORE`}
            variant="confirm"
            onPress={onSubmit}
            disabled={!enough}
            style={styles.flexBtn}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  center: { alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  content: { padding: 16, paddingBottom: 40, gap: 6 },

  h1: { fontFamily: F.display, color: C.text, fontSize: 14, letterSpacing: 1, marginBottom: 6 },
  hint: { fontFamily: F.body, color: C.textDim, fontSize: 16, marginBottom: 12, lineHeight: 22 },
  statusText: { fontFamily: F.display, color: C.accent, fontSize: 9, letterSpacing: 1 },

  input: {
    backgroundColor: C.panel,
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: F.body,
    fontSize: 18,
    color: C.text,
    marginBottom: 6,
  },
  fieldLabel: { fontFamily: F.display, color: C.textDim, fontSize: 7, letterSpacing: 1, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.panel,
  },
  chipActive: { borderColor: C.accent, backgroundColor: C.panelHi },
  chipText: { fontFamily: F.body, color: C.textDim, fontSize: 14 },
  chipTextActive: { color: C.accent },

  resultRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 11, paddingHorizontal: 12, backgroundColor: C.panel,
    borderWidth: 1, borderColor: C.line, marginTop: 6, gap: 10,
  },
  resultMain: { flex: 1 },
  resultLabel: { fontFamily: F.body, color: C.text, fontSize: 17 },
  resultMeta: { fontFamily: F.body, color: C.textDim, fontSize: 13, marginTop: 2, letterSpacing: 0.5 },
  resultTag: { fontFamily: F.display, color: C.green, fontSize: 6, letterSpacing: 1 },
  resultYears: { fontFamily: F.body, color: C.textDim, fontSize: 14 },
  notFound: { marginTop: 16, gap: 10 },
  notFoundText: { fontFamily: F.body, color: C.textDim, fontSize: 16, lineHeight: 22 },

  navRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  flexBtn: { flex: 1 },
  fullBtn: { width: "100%", marginTop: 8 },

  // photo step
  cameraTop: { flex: 1 },
  guideBanner: {
    position: "absolute", top: 12, left: 12, right: 12, alignItems: "center", gap: 2,
  },
  guideAngle: {
    fontFamily: F.display, fontSize: 9, color: C.accent, letterSpacing: 1,
    backgroundColor: "rgba(15,18,28,0.7)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2,
  },
  guideCount: {
    fontFamily: F.body, fontSize: 14, color: C.text,
    backgroundColor: "rgba(15,18,28,0.7)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2,
  },
  captureBtn: {
    position: "absolute", alignSelf: "center", bottom: 200,
    width: 72, height: 72, borderRadius: 4, borderWidth: 3, borderColor: C.text,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)",
  },
  capturePressed: { transform: [{ scale: 0.92 }] },
  captureInner: { width: 48, height: 48, borderRadius: 2, backgroundColor: C.text },
  photoTray: {
    backgroundColor: C.panel, borderTopWidth: 2, borderTopColor: C.line,
    padding: 12, gap: 10,
  },
  trayContent: { gap: 8, minHeight: 60 },
  trayEmpty: { fontFamily: F.body, color: C.textDim, fontSize: 14, paddingVertical: 20 },
  thumbWrap: { width: 60, height: 60 },
  thumb: { width: 60, height: 60, borderRadius: 2, borderWidth: 1, borderColor: C.line },
  thumbX: {
    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.red, alignItems: "center", justifyContent: "center",
  },
  thumbXText: { color: C.text, fontSize: 11, fontFamily: F.body },
  errorText: { fontFamily: F.body, color: C.red, fontSize: 15 },

  // done
  doneCard: { width: "90%", alignItems: "center", gap: 8 },
  doneTitle: { fontFamily: F.display, color: C.green, fontSize: 13, letterSpacing: 1, marginBottom: 4 },
  doneText: { fontFamily: F.body, color: C.textDim, fontSize: 16, textAlign: "center", lineHeight: 22 },
});
