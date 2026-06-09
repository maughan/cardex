import { supabase } from "./supabase";
import type { RarityTier } from "../types";

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
