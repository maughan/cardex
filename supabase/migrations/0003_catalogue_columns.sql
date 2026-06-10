-- =============================================================================
-- CarDex — migration 0003: catalogue enrichment columns
-- Adds the fields the Kaggle dataset provides so a trained model's label space
-- can be ingested into `cars`. Safe/idempotent (IF NOT EXISTS).
-- =============================================================================

alter table cars add column if not exists segment      text;
alter table cars add column if not exists description  text;   -- dex blurb
alter table cars add column if not exists engine        text;
alter table cars add column if not exists variant       text;  -- full title

-- model_class = the training class label (the dataset's variant folder name).
-- The recognition service maps a predicted class -> this -> car_id.
alter table cars add column if not exists model_class   text;

-- Unique on non-null model_class. (Seed cars keep model_class NULL; Postgres
-- treats NULLs as distinct, so they don't collide.) Enables ON CONFLICT upserts
-- from the ingest script.
create unique index if not exists cars_model_class_key on cars (model_class);
