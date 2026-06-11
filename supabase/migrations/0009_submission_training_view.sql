-- =============================================================================
-- CarDex — approved-submission images as training data
-- Exposes one row per image of an APPROVED submission, labeled with the car's
-- model_class. Mirrors training_examples (retained captures) so the export
-- script can union both sources. Images live in the `submissions` bucket
-- (training_examples images live in `training_images`).
--
-- Admin/service-role only — NOT granted to authenticated.
-- =============================================================================

create or replace view submission_training_examples as
select
  si.id            as image_id,
  s.id             as submission_id,
  si.storage_path  as image_path,
  s.car_id,
  c.model_class,                       -- training label
  c.make,
  c.model,
  s.reviewed_at    as approved_at,
  s.reviewed_by
from submission_images si
join car_submissions s on s.id = si.submission_id
join cars c            on c.id = s.car_id
where s.status = 'approved'
  and s.car_id is not null
  and c.model_class is not null;

-- Usage (service role, SQL editor):
--   select model_class, count(*) from submission_training_examples group by 1 order by 2 desc;
