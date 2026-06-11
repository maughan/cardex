-- =============================================================================
-- CarDex — recognition telemetry analytics (flywheel, point 1)
-- The `recognize`/`confirm-catch` path already writes recognition_logs. These
-- views turn that raw log into the signal you act on:
--   * which model_classes the model gets WRONG most (→ where to add training data)
--   * which class it confuses with which (corrected: predicted #1 vs chosen)
--   * correction-rate trend per model_version (→ did a retrain actually help)
--
-- Admin/analytics only: NOT granted to `authenticated`. Query these from the
-- Supabase SQL editor (service role bypasses RLS and sees all users' rows).
-- recognition_logs itself keeps its owner-only RLS for the app.
-- =============================================================================

-- Speeds up the per-car aggregation below.
create index if not exists recognition_logs_chosen_idx
  on recognition_logs (chosen_car_id);
create index if not exists recognition_logs_model_version_idx
  on recognition_logs (model_version);

-- ---------------------------------------------------------------------------
-- 1. Per-car performance — the weak-class finder.
--    High attempts + high correction_pct = a class the model keeps missing.
--    Sort by corrected desc to prioritise what to label/retrain first.
-- ---------------------------------------------------------------------------
create or replace view recognition_by_car as
select
  l.chosen_car_id                                              as car_id,
  c.make,
  c.model,
  c.model_class,
  count(*)                                                     as attempts,
  count(*) filter (where l.was_corrected)                      as corrected,
  round(100.0 * count(*) filter (where l.was_corrected)
        / nullif(count(*), 0), 1)                              as correction_pct
from recognition_logs l
join cars c on c.id = l.chosen_car_id
group by l.chosen_car_id, c.make, c.model, c.model_class;

-- ---------------------------------------------------------------------------
-- 2. Confusion pairs — on corrections, what the model guessed #1 vs the truth.
--    guesses is the ranked candidate array stored by confirm-catch; element 0
--    is the model's top pick. Reveals systematic visual-peer confusions
--    (e.g. always calls an A4 a Passat).
-- ---------------------------------------------------------------------------
create or replace view recognition_confusion as
select
  (l.guesses -> 0 ->> 'carId')::bigint                         as predicted_car_id,
  pc.make || ' ' || pc.model                                   as predicted_label,
  l.chosen_car_id                                              as actual_car_id,
  ac.make || ' ' || ac.model                                   as actual_label,
  count(*)                                                     as n
from recognition_logs l
left join cars pc on pc.id = (l.guesses -> 0 ->> 'carId')::bigint
left join cars ac on ac.id = l.chosen_car_id
where l.was_corrected
  and (l.guesses -> 0 ->> 'carId') is not null
group by 1, 2, 3, 4
order by n desc;

-- ---------------------------------------------------------------------------
-- 3. Daily trend per model version — did a retrain move the needle?
-- ---------------------------------------------------------------------------
create or replace view recognition_daily as
select
  date_trunc('day', created_at)::date                          as day,
  coalesce(model_version, '?')                                 as model_version,
  count(*)                                                     as attempts,
  count(*) filter (where was_corrected)                        as corrected,
  round(100.0 * count(*) filter (where was_corrected)
        / nullif(count(*), 0), 1)                              as correction_pct
from recognition_logs
group by 1, 2
order by 1 desc, 2;

-- Usage (run as service role in the SQL editor):
--   select * from recognition_by_car  where attempts >= 5 order by corrected desc;
--   select * from recognition_confusion limit 30;
--   select * from recognition_daily;
