import { supabase } from "./supabase";
import type { RarityTier } from "../types";
import { RARITY_POINTS, rarityRank } from "./rarity";

export interface GarageEntry {
  carId: number;
  label: string;
  rarityTier: RarityTier;
  spriteUrl: string | null;
  spottedCount: number;
  lastCaughtAt: string;
}

export interface SetProgress {
  setId: number;
  slug: string;
  name: string;
  totalCars: number;
  caughtCars: number;
  pctComplete: number;
}

// Shapes returned by the PostgREST embed below.
interface SpriteRow {
  asset_url: string;
  is_current: boolean;
}
interface CarRow {
  make: string;
  model: string;
  generation: string | null;
  rarity_tier: RarityTier;
  sprites: SpriteRow[];
}
interface CatchRow {
  car_id: number;
  spotted_count: number;
  last_caught_at: string;
  cars: CarRow | null;
}

// The user's collection. RLS restricts catches to the caller; catalogue +
// sprites are embedded through the car_id foreign key.
export async function fetchGarage(): Promise<GarageEntry[]> {
  const { data, error } = await supabase
    .from("catches")
    .select(
      `car_id, spotted_count, last_caught_at,
       cars ( make, model, generation, rarity_tier,
              sprites ( asset_url, is_current ) )`,
    )
    .order("last_caught_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as CatchRow[])
    .filter((row) => row.cars != null)
    .map((row) => {
      const car = row.cars as CarRow;
      const current = car.sprites?.find((s) => s.is_current);
      const label = `${car.make} ${car.model}${car.generation ? " " + car.generation : ""}`;
      return {
        carId: row.car_id,
        label,
        rarityTier: car.rarity_tier,
        spriteUrl: current?.asset_url ?? null,
        spottedCount: row.spotted_count,
        lastCaughtAt: row.last_caught_at,
      };
    });
}

// Per-set completion for the current user, from the user_set_progress view.
export async function fetchSetProgress(): Promise<SetProgress[]> {
  const { data, error } = await supabase
    .from("user_set_progress")
    .select("set_id, slug, name, total_cars, caught_cars, pct_complete")
    .order("pct_complete", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    setId: r.set_id as number,
    slug: r.slug as string,
    name: r.name as string,
    totalCars: r.total_cars as number,
    caughtCars: r.caught_cars as number,
    pctComplete: Number(r.pct_complete ?? 0),
  }));
}

export interface CatalogueCar {
  carId: number;
  label: string;
  rarityTier: RarityTier;
  yearStart: number | null;
  yearEnd: number | null;
  body: string | null;
  productionYears: string | null; // raw, meaningful range string for display
}

export interface SetCarEntry {
  carId: number;
  label: string;
  rarityTier: RarityTier;
  spriteUrl: string | null;
  caught: boolean;
}

// All cars in a set, flagged with whether the signed-in user has caught each.
export async function fetchSetCars(slug: string): Promise<SetCarEntry[]> {
  const { data, error } = await supabase
    .from("set_cars")
    .select(
      `car_id,
       cars!inner ( make, model, generation, rarity_tier,
                    sprites ( asset_url, is_current ) ),
       sets!inner ( slug )`,
    )
    .eq("sets.slug", slug);
  if (error) throw new Error(error.message);

  type Row = {
    car_id: number;
    cars: {
      make: string;
      model: string;
      generation: string | null;
      rarity_tier: RarityTier;
      sprites: Array<{ asset_url: string; is_current: boolean }>;
    } | null;
  };

  const base = ((data ?? []) as unknown as Row[])
    .filter((r) => r.cars != null)
    .map((r) => {
      const car = r.cars!;
      const current = car.sprites?.find((s) => s.is_current);
      return {
        carId: r.car_id,
        label: `${car.make} ${car.model}${car.generation ? " " + car.generation : ""}`,
        rarityTier: car.rarity_tier,
        spriteUrl: current?.asset_url ?? null,
      };
    });

  // Which of these cars has the user caught? (catches is RLS-scoped to them.)
  const ids = base.map((c) => c.carId);
  let caughtIds = new Set<number>();
  if (ids.length > 0) {
    const { data: caught, error: e2 } = await supabase
      .from("catches")
      .select("car_id")
      .in("car_id", ids);
    if (e2) throw new Error(e2.message);
    caughtIds = new Set((caught ?? []).map((r) => r.car_id as number));
  }

  return base
    .map((c) => ({ ...c, caught: caughtIds.has(c.carId) }))
    .sort((a, b) =>
      rarityRank(b.rarityTier) - rarityRank(a.rarityTier) ||
      a.label.localeCompare(b.label)
    );
}

export interface CatchLocation {
  carId: number;
  label: string;
  rarityTier: RarityTier;
  lat: number;
  lng: number;
  caughtAt: string;
}

// GPS-tagged catches for the map / heat-map. Catches without coordinates are
// excluded.
export async function fetchCatchLocations(): Promise<CatchLocation[]> {
  const { data, error } = await supabase
    .from("catches")
    .select(
      `car_id, last_lat, last_lng, last_caught_at,
       cars ( make, model, generation, rarity_tier )`,
    )
    .not("last_lat", "is", null)
    .not("last_lng", "is", null);
  if (error) throw new Error(error.message);

  type Row = {
    car_id: number;
    last_lat: number | null;
    last_lng: number | null;
    last_caught_at: string;
    cars: {
      make: string;
      model: string;
      generation: string | null;
      rarity_tier: RarityTier;
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.cars != null && r.last_lat != null && r.last_lng != null)
    .map((r) => {
      const car = r.cars!;
      return {
        carId: r.car_id,
        label: `${car.make} ${car.model}${car.generation ? " " + car.generation : ""}`,
        rarityTier: car.rarity_tier,
        lat: r.last_lat as number,
        lng: r.last_lng as number,
        caughtAt: r.last_caught_at,
      };
    });
}

export interface ProfileStats {
  totalCaught: number; // unique cars
  totalSightings: number; // sum of spotted_count
  rarityCounts: Record<RarityTier, number>;
  rarityScore: number;
  rarest: { label: string; rarityTier: RarityTier } | null;
  catalogueSize: number;
  completionPct: number;
  setsCompleted: number;
  setsTotal: number;
}

// Total number of cars in the catalogue (head request, no rows transferred).
async function countCars(): Promise<number> {
  const { count, error } = await supabase
    .from("cars")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Aggregate the signed-in user's collection into profile stats.
export async function fetchProfileStats(): Promise<ProfileStats> {
  const [garage, sets, catalogueSize] = await Promise.all([
    fetchGarage(),
    fetchSetProgress(),
    countCars(),
  ]);

  const rarityCounts = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  } as Record<RarityTier, number>;

  let totalSightings = 0;
  let rarityScore = 0;
  let rarest: { label: string; rarityTier: RarityTier } | null = null;

  for (const c of garage) {
    rarityCounts[c.rarityTier] += 1;
    totalSightings += c.spottedCount;
    rarityScore += RARITY_POINTS[c.rarityTier];
    if (!rarest || rarityRank(c.rarityTier) > rarityRank(rarest.rarityTier)) {
      rarest = { label: c.label, rarityTier: c.rarityTier };
    }
  }

  return {
    totalCaught: garage.length,
    totalSightings,
    rarityCounts,
    rarityScore,
    rarest,
    catalogueSize,
    completionPct: catalogueSize > 0
      ? Math.round((garage.length / catalogueSize) * 1000) / 10
      : 0,
    setsCompleted: sets.filter((s) => s.pctComplete >= 100).length,
    setsTotal: sets.length,
  };
}

// Search the public catalogue by make/model for the manual-pick flow.
// Input is sanitized before being placed in the PostgREST `or` filter.
export async function searchCars(query: string): Promise<CatalogueCar[]> {
  // Strip characters that have meaning in a PostgREST filter string.
  const safe = query.replace(/[%,()*\\]/g, "").trim();

  let req = supabase
    .from("cars")
    .select("id, make, model, generation, rarity_tier, year_start, year_end, body, production_years")
    .order("make")
    .order("model")
    .limit(40);

  if (safe.length > 0) {
    req = req.or(`make.ilike.%${safe}%,model.ilike.%${safe}%`);
  }

  const { data, error } = await req;
  // PostgrestError isn't a JS Error, so wrap it to surface the real message
  // (e.g. "relation public.cars does not exist", "permission denied").
  if (error) {
    console.error("searchCars failed:", error);
    throw new Error(error.message || "Catalogue search failed");
  }

  return ((data ?? []) as Array<{
    id: number;
    make: string;
    model: string;
    generation: string | null;
    rarity_tier: RarityTier;
    year_start: number | null;
    year_end: number | null;
    body: string | null;
    production_years: string | null;
  }>).map((c) => ({
    carId: c.id,
    label: `${c.make} ${c.model}${c.generation ? " " + c.generation : ""}`,
    rarityTier: c.rarity_tier,
    yearStart: c.year_start,
    yearEnd: c.year_end,
    body: c.body,
    productionYears: c.production_years,
  }));
}

// --- Training-image consent --------------------------------------------------

// Whether the user has opted in to sharing catch photos as training data.
export async function fetchShareTrainingImages(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("share_training_images")
    .eq("id", uid)
    .maybeSingle();
  if (error) {
    console.error("fetchShareTrainingImages failed:", error);
    return false;
  }
  return Boolean(data?.share_training_images);
}

export interface CarDetail {
  carId: number;
  make: string;
  model: string;
  generation: string | null;
  variant: string | null;
  description: string | null;
  engine: string | null;
  segment: string | null;
  body: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  productionYears: string | null;
  rarityTier: RarityTier;
  modelClass: string | null;
  spriteUrl: string | null;
  // user catch state
  caught: boolean;
  spottedCount: number;
  firstCaughtAt: string | null;
  lastCaughtAt: string | null;
  bestConfidence: number | null;
  lastLat: number | null;
  lastLng: number | null;
}

export async function fetchCarDetail(carId: number): Promise<CarDetail> {
  const { data: car, error } = await supabase
    .from("cars")
    .select(
      "id, make, model, generation, variant, description, engine, segment, body, " +
      "year_start, year_end, production_years, rarity_tier, model_class",
    )
    .eq("id", carId)
    .single();
  if (error || !car) throw new Error(error?.message || "Car not found");
  const c = car as Record<string, unknown>;

  const { data: sprite } = await supabase
    .from("sprites")
    .select("asset_url")
    .eq("car_id", carId)
    .eq("is_current", true)
    .maybeSingle();

  // RLS scopes catches to the current user, so this is "did I catch it".
  const { data: caught } = await supabase
    .from("catches")
    .select("spotted_count, first_caught_at, last_caught_at, best_confidence, last_lat, last_lng")
    .eq("car_id", carId)
    .maybeSingle();
  const k = caught as Record<string, unknown> | null;

  return {
    carId: c.id as number,
    make: c.make as string,
    model: c.model as string,
    generation: (c.generation as string) ?? null,
    variant: (c.variant as string) ?? null,
    description: (c.description as string) ?? null,
    engine: (c.engine as string) ?? null,
    segment: (c.segment as string) ?? null,
    body: (c.body as string) ?? null,
    yearStart: (c.year_start as number) ?? null,
    yearEnd: (c.year_end as number) ?? null,
    productionYears: (c.production_years as string) ?? null,
    rarityTier: c.rarity_tier as RarityTier,
    modelClass: (c.model_class as string) ?? null,
    spriteUrl: (sprite?.asset_url as string) ?? null,
    caught: !!k,
    spottedCount: (k?.spotted_count as number) ?? 0,
    firstCaughtAt: (k?.first_caught_at as string) ?? null,
    lastCaughtAt: (k?.last_caught_at as string) ?? null,
    bestConfidence: (k?.best_confidence as number) ?? null,
    lastLat: (k?.last_lat as number) ?? null,
    lastLng: (k?.last_lng as number) ?? null,
  };
}

export interface SimilarCar {
  carId: number;
  label: string;
  yearStart: number | null;
  yearEnd: number | null;
  productionYears: string | null;
}

// Targeted dedupe for the contribute flow: cars matching BOTH make and model.
export async function fetchSimilarCars(make: string, model: string): Promise<SimilarCar[]> {
  const m = make.replace(/[%,()*\\]/g, "").trim();
  const md = model.replace(/[%,()*\\]/g, "").trim();
  if (!m || !md) return [];
  const { data, error } = await supabase
    .from("cars")
    .select("id, make, model, generation, year_start, year_end, production_years")
    .ilike("make", `%${m}%`)
    .ilike("model", `%${md}%`)
    .limit(6);
  if (error) {
    console.error("fetchSimilarCars failed:", error);
    return [];
  }
  return (data ?? []).map((c) => {
    const r = c as {
      id: number; make: string; model: string; generation: string | null;
      year_start: number | null; year_end: number | null; production_years: string | null;
    };
    return {
      carId: r.id,
      label: `${r.make} ${r.model}${r.generation ? " " + r.generation : ""}`,
      yearStart: r.year_start,
      yearEnd: r.year_end,
      productionYears: r.production_years,
    };
  });
}

// Distinct makes already in the catalogue — for the contribute dropdown.
export async function fetchMakes(): Promise<string[]> {
  const { data, error } = await supabase.from("cars").select("make").order("make");
  if (error) {
    console.error("fetchMakes failed:", error);
    return [];
  }
  return Array.from(new Set((data ?? []).map((r) => (r as { make: string }).make)));
}

export interface Achievement {
  kind: string;
  tier: string | null;
  awardedAt: string;
}

export async function fetchAchievements(): Promise<Achievement[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("achievements")
    .select("kind, tier, awarded_at")
    .eq("user_id", uid)
    .order("awarded_at");
  if (error) {
    console.error("fetchAchievements failed:", error);
    return [];
  }
  return (data ?? []).map((a) => {
    const r = a as { kind: string; tier: string | null; awarded_at: string };
    return { kind: r.kind, tier: r.tier, awardedAt: r.awarded_at };
  });
}

export async function setShareTrainingImages(value: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in — sign in to change this.");
  const { data, error } = await supabase
    .from("profiles")
    .update({ share_training_images: value })
    .eq("id", uid)
    .select("id");
  if (error) throw new Error(error.message || "Couldn't update preference");
  // No row updated = the profile doesn't exist (apply migration 0007).
  if (!data || data.length === 0) {
    throw new Error("No profile found for your account.");
  }
}
