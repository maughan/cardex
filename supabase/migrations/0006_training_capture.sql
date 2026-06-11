-- =============================================================================
-- CarDex — training-image retention (flywheel, point 2)
-- Opt-in retention of real capture photos as labeled training data.
--   * profiles.share_training_images — per-user consent, OFF by default.
--   * recognition_logs gains request_id (links recognize↔confirm), image_path
--     (object key in the private `training_images` bucket), and retained.
--
-- Images are only ever written when the user has consented; the column default
-- and the Edge Function gate both enforce off-by-default.
-- =============================================================================

-- Per-user consent. Off by default — retention requires an explicit opt-in.
alter table profiles
  add column if not exists share_training_images boolean not null default false;

-- Link + provenance on the log row.
alter table recognition_logs
  add column if not exists request_id text;
alter table recognition_logs
  add column if not exists image_path text;     -- object key in training_images bucket
alter table recognition_logs
  add column if not exists retained boolean not null default false;

create index if not exists recognition_logs_request_id_idx
  on recognition_logs (request_id);

-- Labeled-example export (admin/service-role only — NOT granted to authenticated).
-- One row per retained capture with its confirmed label + storage key. This is
-- the set you download + fold into the training data.
create or replace view training_examples as
select
  l.id            as log_id,
  l.request_id,
  l.image_path,
  l.chosen_car_id as car_id,
  c.model_class,                       -- the training label
  c.make,
  c.model,
  l.was_corrected,                     -- corrections are the highest-value examples
  l.model_version,
  l.spoof_score,
  l.created_at
from recognition_logs l
join cars c on c.id = l.chosen_car_id
where l.retained = true
  and l.image_path is not null;

-- ---------------------------------------------------------------------------
-- Storage bucket policy reminder (run once, or set in the dashboard):
--   The `training_images` bucket must be PRIVATE (no public read). Writes come
--   only from the Edge Function using the service-role key (bypasses RLS), and
--   reads for export use short-lived signed URLs. So NO storage.objects policy
--   granting anon/authenticated access should exist for this bucket.
--   If you added any public policy when creating it, remove it.
-- ---------------------------------------------------------------------------
