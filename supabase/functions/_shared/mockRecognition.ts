// DEV-ONLY mock recognition.
// Returns realistic candidates drawn from the seeded `cars` catalogue so the
// full capture → confirm → reveal → garage loop works before the real ML
// service exists. Because the carIds are genuine, confirm-catch writes a real
// row and the garage populates. Delete this (and its branch in recognize)
// once the recognition service is live.

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CarRow {
  id: number;
  make: string;
  model: string;
  generation: string | null;
  rarity_tier: string;
}

// Descending confidences for the ranked list (top guess clearly leads).
const CONFIDENCES = [0.93, 0.05, 0.013, 0.007];

export async function mockRecognize(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("cars")
    .select("id, make, model, generation, rarity_tier");

  if (error) {
    // Surface the DB error so the rejection screen shows the real cause
    // (most often: migrations/seed not applied, or table grants missing).
    console.error("mockRecognize: cars read failed:", error.message);
    return { isReal: true, candidates: [], reason: `catalogue read failed: ${error.message}`, modelVersion: "mock-1" };
  }
  if (!data || data.length === 0) {
    return { isReal: true, candidates: [], reason: "no_cars_seeded", modelVersion: "mock-1" };
  }

  const cars = data as CarRow[];
  // Shuffle and take up to 4 as the candidate list.
  const shuffled = [...cars].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, Math.min(4, shuffled.length));

  const candidates = picks.map((c, i) => ({
    carId: c.id,
    label: `${c.make} ${c.model}${c.generation ? " " + c.generation : ""}`,
    confidence: CONFIDENCES[i] ?? 0.005,
    rarityTier: c.rarity_tier,
  }));

  return {
    isReal: true,
    spoofScore: 0.02,
    candidates,
    modelVersion: "mock-1",
    requestId: crypto.randomUUID(),
  };
}
