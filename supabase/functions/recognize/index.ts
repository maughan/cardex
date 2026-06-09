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
import { getUserId, userClient } from "../_shared/clients.ts";
import { mockRecognize } from "../_shared/mockRecognition.ts";

const RECOGNITION_URL = Deno.env.get("RECOGNITION_URL")!;
const RECOGNITION_TOKEN = Deno.env.get("RECOGNITION_TOKEN")!;
const MOCK = Deno.env.get("MOCK_RECOGNITION") === "true";

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
  upstream.append("image", image, image.name || "capture.jpg");
  if (lat !== null) upstream.append("lat", String(lat));
  if (lng !== null) upstream.append("lng", String(lng));
  upstream.append("ts", ts);

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

  // 5. Pass the verdict + candidates back to the client.
  //    Shape: { isReal, spoofScore, candidates[], modelVersion, requestId }
  const result = await recRes.json();
  return json(result);
});
