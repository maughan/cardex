// =============================================================================
// Edge Function: recognize
// The gateway in front of the recognition service.
//   1. Authenticates the user
//   2. Runs lightweight pre-checks (live-capture flag, GPS sanity)
//   3. Forwards the transient image to the recognition service with a
//      short-lived service token
//   4. Returns { isReal, candidates[], confidence, modelVersion } to the client,
//      which then shows the confirm/correct step.
//
// The image is never persisted here — it is streamed straight upstream.
//
// Deploy:  supabase functions deploy recognize
// Secrets: supabase secrets set RECOGNITION_URL=... RECOGNITION_TOKEN=...
// =============================================================================

import { corsHeaders, json } from "../_shared/cors.ts";
import { getUserId, serviceClient, userClient } from "../_shared/clients.ts";
import { mockRecognize } from "../_shared/mockRecognition.ts";

const RECOGNITION_URL = Deno.env.get("RECOGNITION_URL")!;
const RECOGNITION_TOKEN = Deno.env.get("RECOGNITION_TOKEN")!;
const MOCK = Deno.env.get("MOCK_RECOGNITION") === "true";
const TRAINING_BUCKET = "training_images";

function validCoord(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return true; // coordinates are optional
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // 1. Auth
  const supabase = userClient(req);
  const userId = await getUserId(supabase);
  if (!userId) return json({ error: "unauthorized" }, 401);

  // DEV: mock recognition — return realistic candidates from the seeded
  // catalogue without requiring a photo or the (non-existent) ML service.
  // Placed before form parsing so the dev "simulate catch" path works with no
  // image. Toggle with MOCK_RECOGNITION.
  if (MOCK) {
    return json(await mockRecognize(supabase));
  }

  // 2. Parse multipart input
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "expected_multipart_form_data" }, 400);
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return json({ error: "missing_image" }, 400);
  }
  // Read the bytes once, up front: we reuse them for the upstream forward AND
  // (only on consent + a real car) the training-image upload. Reading after the
  // forward consumes the stream, so capture them now.
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const imageType = image.type || "image/jpeg";

  const latRaw = form.get("lat");
  const lngRaw = form.get("lng");
  const lat = latRaw !== null ? Number(latRaw) : null;
  const lng = lngRaw !== null ? Number(lngRaw) : null;
  const ts = (form.get("ts") as string | null) ?? new Date().toISOString();
  const liveCapture = form.get("liveCapture") === "true";

  // 3. Lightweight gateway pre-checks
  if (!liveCapture) {
    // Honest clients always set this; missing it is treated as a soft reject.
    return json({ isReal: false, reason: "not_live_capture", candidates: [] });
  }
  if (!validCoord(lat, lng)) {
    return json({ error: "invalid_coordinates" }, 400);
  }

  // 4. Forward to the recognition service (image stays transient)
  const upstream = new FormData();
  upstream.append(
    "image",
    new Blob([imageBytes], { type: imageType }),
    image.name || "capture.jpg",
  );
  if (lat !== null) upstream.append("lat", String(lat));
  if (lng !== null) upstream.append("lng", String(lng));
  upstream.append("ts", ts);
  upstream.append("liveCapture", String(liveCapture));

  let recRes: Response;
  try {
    recRes = await fetch(`${RECOGNITION_URL}/v1/recognize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RECOGNITION_TOKEN}` },
      body: upstream,
    });
  } catch (_e) {
    return json({ error: "recognition_unavailable" }, 503);
  }

  if (!recRes.ok) {
    return json({ error: "recognition_failed", status: recRes.status }, 502);
  }

  // 5. The recognition service returns predictions keyed by model_class.
  //    Resolve them to catalogue candidates via the cars table.
  const result = await recRes.json();

  // Rejection (not a real car / spoof / no car) passes straight through.
  if (!result.isReal) return json(result);

  const predictions: Array<{ modelClass: string; confidence: number }> =
    Array.isArray(result.predictions) ? result.predictions : [];

  // Back-compat: the mock branch (and any service that already returns
  // candidates) needs no resolution.
  if (predictions.length === 0) return json(result);

  const classes = predictions.map((p) => p.modelClass);
  const { data: cars, error: carErr } = await supabase
    .from("cars")
    .select("id, make, model, generation, rarity_tier, model_class")
    .in("model_class", classes);
  if (carErr) {
    return json({ error: "catalogue_lookup_failed", detail: carErr.message }, 500);
  }

  const byClass = new Map((cars ?? []).map((c) => [c.model_class, c]));
  const candidates = predictions
    .map((p) => {
      const c = byClass.get(p.modelClass);
      if (!c) return null;
      const label = `${c.make} ${c.model}${c.generation ? " " + c.generation : ""}`;
      return {
        carId: c.id as number,
        label,
        confidence: p.confidence,
        rarityTier: c.rarity_tier as string,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Predicted classes exist but none are in the catalogue yet.
  if (candidates.length === 0) {
    return json({
      isReal: false,
      reason: "no_catalogue_match",
      candidates: [],
      requestId: result.requestId,
    });
  }

  // Opt-in training-image retention. Best-effort — a failure here must never
  // fail the recognition. Only runs when the user consented (off by default)
  // and only on a real car (we don't keep rejected/non-car frames).
  const requestId = (result.requestId as string | undefined) ?? crypto.randomUUID();
  let imagePath: string | null = null;
  let retained = false;
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("share_training_images")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.share_training_images) {
      const path = `${userId}/${requestId}.jpg`;
      const { error: upErr } = await serviceClient().storage
        .from(TRAINING_BUCKET)
        .upload(path, imageBytes, { contentType: imageType, upsert: true });
      if (upErr) {
        console.error("training image upload failed:", upErr.message);
      } else {
        imagePath = path;
        retained = true;
      }
    }
  } catch (e) {
    console.error("retention error:", e instanceof Error ? e.message : String(e));
  }

  return json({
    isReal: true,
    spoofScore: result.spoofScore,
    candidates,
    modelVersion: result.modelVersion,
    requestId,
    imagePath,
    retained,
  });
});
