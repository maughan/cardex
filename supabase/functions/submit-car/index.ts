// =============================================================================
// Edge Function: submit-car
// A user proposes a new car + the photos they captured for it. Images are
// already uploaded by the client to the private `submissions` bucket under
// their own uid/ folder; this records the submission + image rows as `pending`
// for admin audit in Supabase Studio.
//
// Deploy: supabase functions deploy submit-car
// =============================================================================

import { corsHeaders, json } from "../_shared/cors.ts";
import { getUserId, userClient } from "../_shared/clients.ts";

const BODY_TYPES = [
  "hatchback", "sedan", "coupe", "suv", "truck",
  "van", "wagon", "convertible", "sports", "other",
];
const MIN_IMAGES = 3;

interface SubmitBody {
  make?: string;
  model?: string;
  generation?: string;
  yearStart?: number;
  yearEnd?: number;
  body?: string;
  imagePaths?: string[]; // keys in the `submissions` bucket, under <uid>/...
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

  let b: SubmitBody;
  try {
    b = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const make = (b.make ?? "").trim();
  const model = (b.model ?? "").trim();
  if (!make || !model) return json({ error: "make_and_model_required" }, 400);

  const body = BODY_TYPES.includes(b.body ?? "") ? b.body! : "other";

  const paths = Array.isArray(b.imagePaths) ? b.imagePaths.filter((p) => typeof p === "string") : [];
  if (paths.length < MIN_IMAGES) {
    return json({ error: "need_more_images", min: MIN_IMAGES, got: paths.length }, 400);
  }
  // Only accept objects under the caller's own folder (defence in depth — the
  // storage policy already enforces this on write).
  const prefix = `${userId}/`;
  if (!paths.every((p) => p.startsWith(prefix))) {
    return json({ error: "invalid_image_path" }, 400);
  }

  // Soft duplicate hint — don't block (years/variants legitimately differ), but
  // surface it so the admin can merge/reject if it's a true dupe.
  const { data: dupes } = await supabase
    .from("cars")
    .select("id, make, model, year_start, year_end")
    .ilike("make", make)
    .ilike("model", model)
    .limit(5);

  const { data: sub, error: subErr } = await supabase
    .from("car_submissions")
    .insert({
      submitted_by: userId,
      make,
      model,
      generation: b.generation?.trim() || null,
      year_start: Number.isFinite(b.yearStart) ? b.yearStart : null,
      year_end: Number.isFinite(b.yearEnd) ? b.yearEnd : null,
      body,
    })
    .select("id")
    .single();
  if (subErr || !sub) {
    return json({ error: "submission_failed", detail: subErr?.message }, 400);
  }

  const rows = paths.map((p) => ({ submission_id: sub.id, storage_path: p }));
  const { error: imgErr } = await supabase.from("submission_images").insert(rows);
  if (imgErr) {
    // Roll back the submission so we don't leave one with no images.
    await supabase.from("car_submissions").delete().eq("id", sub.id);
    return json({ error: "image_record_failed", detail: imgErr.message }, 400);
  }

  return json({
    submissionId: sub.id,
    status: "pending",
    imageCount: paths.length,
    possibleDuplicates: dupes ?? [],
  });
});
