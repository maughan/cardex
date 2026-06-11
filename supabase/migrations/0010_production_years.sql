-- =============================================================================
-- CarDex — store the meaningful production-years string
-- The dataset's from_year/to_year are unreliable (they produced nonsense ranges
-- like 1930–2024). `production_years` (e.g. "1993–2002", "2019–present") is the
-- field that actually differentiates models. build_manifest now parses it into
-- year_start/year_end (for set logic) AND carries the raw string here for
-- display.
-- =============================================================================

alter table cars
  add column if not exists production_years text;
