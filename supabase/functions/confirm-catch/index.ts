// =============================================================================
// Edge Function: confirm-catch
// Called after the user confirms / corrects the recognition result.
//   1. Records the catch atomically via record_catch() (RLS + cooldown enforced
//      server-side through auth.uid())
//   2. Logs the attempt to recognition_logs (the data flywheel)
//   3. Returns the card payload for the reveal animation
//
// Deploy: supabase functions deploy confirm-catch
// =============================================================================

import { corsHeaders, json } from "../_shared/cors.ts";
import { getUserId, userClient } from "../_shared/clients.ts";

interface ConfirmBody {
  carId: number; // the model the user confirmed/corrected to
  topGuessCarId?: number; // model's #1 guess, to derive was_corrected
  confidence?: number;
  lat?: number;
  lng?: number;
  photoRef?: string; // on-device reference only — never a server blob
  guesses?: unknown; // raw ranked candidates, stored for training
  modelVersion?: string;
  spoofScore?: number;
}

interface CatchRow {
  id: number;
  car_id: number;
  spotted_count: number;
  first_caught_at: string;
  last_caught_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabase = userClient(req);
  const userId = await getUserId(supabase);
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: ConfirmBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (typeof body.carId !== "number") {
    return json({ error: "carId_required" }, 400);
  }

  // 1. Atomic catch upsert. record_catch enforces the cooldown and uses
  //    auth.uid() internally, so the user can only write their own catch.
  const { data: caught, error: rpcErr } = await supabase.rpc("record_catch", {
    p_car_id: body.carId,
    p_confidence: body.confidence ?? null,
    p_lat: body.lat ?? null,
    p_lng: body.lng ?? null,
    p_photo_ref: body.photoRef ?? null,
  });
  if (rpcErr) {
    return json({ error: "record_failed", detail: rpcErr.message }, 400);
  }

  const catchRow = (Array.isArray(caught) ? caught[0] : caught) as CatchRow;

  // Heuristic "new catch" signal for the reveal animation. (A repeat sighting
  // inside the cooldown leaves the row unchanged, so this can read as new in
  // that rare window — acceptable for a celebratory animation.)
  const isNew = catchRow.spotted_count === 1 &&
    catchRow.first_caught_at === catchRow.last_caught_at;

  // 2. Flywheel log — best-effort; a logging failure must not fail the catch.
  const wasCorrected = typeof body.topGuessCarId === "number" &&
    body.topGuessCarId !== body.carId;
  const { error: logErr } = await supabase.from("recognition_logs").insert({
    user_id: userId,
    guesses: body.guesses ?? [],
    chosen_car_id: body.carId,
    was_corrected: wasCorrected,
    model_version: body.modelVersion ?? null,
    spoof_score: body.spoofScore ?? null,
  });
  if (logErr) console.error("recognition_logs insert failed:", logErr.message);

  // 3. Build the card payload (catalogue data is public-read under RLS).
  const { data: car } = await supabase
    .from("cars")
    .select("id, make, model, generation, rarity_tier")
    .eq("id", body.carId)
    .single();

  const { data: sprite } = await supabase
    .from("sprites")
    .select("asset_url")
    .eq("car_id", body.carId)
    .eq("is_current", true)
    .maybeSingle();

  const label = car
    ? `${car.make} ${car.model}${car.generation ? " " + car.generation : ""}`
    : null;

  // 4. Did this catch just complete any set? Only possible on a first catch:
  //    if the car was already owned (isNew=false) no set newly completes. For a
  //    new car, any set it belongs to that is now 100% must have just finished.
  let completedSets: Array<{ slug: string; name: string }> = [];
  if (isNew) {
    const { data: members } = await supabase
      .from("set_cars")
      .select("set_id")
      .eq("car_id", body.carId);
    const setIds = (members ?? []).map((m) => m.set_id as number);

    if (setIds.length > 0) {
      const { data: progress } = await supabase
        .from("user_set_progress")
        .select("set_id, slug, name, pct_complete")
        .in("set_id", setIds);
      completedSets = (progress ?? [])
        .filter((p) => Number(p.pct_complete) >= 100)
        .map((p) => ({ slug: p.slug as string, name: p.name as string }));
    }
  }

  return json({
    isNew,
    catch: catchRow,
    card: {
      carId: body.carId,
      label,
      rarityTier: car?.rarity_tier ?? null,
      spriteUrl: sprite?.asset_url ?? null,
      spottedCount: catchRow.spotted_count,
    },
    completedSets,
  });
});
