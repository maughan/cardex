-- =============================================================================
-- CarDex — community car submissions (backend foundation)
-- Users propose new cars + upload training photos; an admin audits in Supabase
-- Studio and approves, which mints the catalogue car + a model_class and awards
-- a contributor badge. Approved submission images feed the training export.
--
-- Moderation surface = Supabase Studio (SQL editor + Storage browser). The
-- review functions are SECURITY DEFINER and are NOT granted to `authenticated`,
-- so only the service role (Studio / server) can approve/reject.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Roles & a helper. role drives any future in-app admin UI; Studio review
--    doesn't need it (service role bypasses RLS).
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- 2. Submissions + their images.
-- ---------------------------------------------------------------------------
create table car_submissions (
  id           bigint generated always as identity primary key,
  submitted_by uuid        not null references auth.users(id) on delete cascade,
  status       text        not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  make         text        not null,
  model        text        not null,
  generation   text,
  year_start   int,
  year_end     int,
  body         body_type   not null default 'other',
  model_class  text,                                   -- minted on approval
  car_id       bigint      references cars(id),         -- set on approval
  notes        text,                                    -- admin review notes
  reviewed_by  uuid        references auth.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index car_submissions_status_idx on car_submissions (status);
create index car_submissions_user_idx   on car_submissions (submitted_by);

create table submission_images (
  id            bigint generated always as identity primary key,
  submission_id bigint      not null references car_submissions(id) on delete cascade,
  storage_path  text        not null,                  -- key in `submissions` bucket
  created_at    timestamptz not null default now()
);
create index submission_images_sub_idx on submission_images (submission_id);

-- ---------------------------------------------------------------------------
-- 3. Achievements (generic; first use = contributor badge tiers).
-- ---------------------------------------------------------------------------
create table achievements (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null,                    -- e.g. 'contributor'
  tier        text,                                    -- bronze / silver / gold
  awarded_at  timestamptz not null default now(),
  unique (user_id, kind, tier)
);
create index achievements_user_idx on achievements (user_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table car_submissions  enable row level security;
alter table submission_images enable row level security;
alter table achievements      enable row level security;

-- Submissions: a user creates + reads their own; admins read/update all.
create policy "insert own submission" on car_submissions
  for insert to authenticated with check (submitted_by = (select auth.uid()));
create policy "read own or admin submissions" on car_submissions
  for select to authenticated
  using (submitted_by = (select auth.uid()) or is_admin());
create policy "admin update submissions" on car_submissions
  for update to authenticated using (is_admin()) with check (is_admin());

-- Submission images: insert only against your own (still-pending) submission;
-- read your own or admin.
create policy "insert own submission image" on submission_images
  for insert to authenticated with check (
    exists (
      select 1 from car_submissions s
      where s.id = submission_id
        and s.submitted_by = (select auth.uid())
        and s.status = 'pending'
    )
  );
create policy "read own or admin submission images" on submission_images
  for select to authenticated using (
    exists (
      select 1 from car_submissions s
      where s.id = submission_id
        and (s.submitted_by = (select auth.uid()) or is_admin())
    )
  );

-- Achievements: read your own (and admins all). Inserts happen via the
-- SECURITY DEFINER approval fn, so no client insert policy.
create policy "read own or admin achievements" on achievements
  for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

grant select, insert on car_submissions  to authenticated;
grant select, insert on submission_images to authenticated;
grant select          on achievements     to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Review functions (admin / service-role only — NOT granted to authenticated)
-- ---------------------------------------------------------------------------

-- Sanitise a token for the model_class key (build_manifest folder convention).
create or replace function public._slug_token(s text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(coalesce(s, ''), '[^A-Za-z0-9]+', '_', 'g'), '^_+|_+$', '', 'g');
$$;

-- Approve: mint car + model_class, link, award contributor badge.
create or replace function public.approve_submission(
  p_id     bigint,
  p_rarity rarity_tier default 'common'
)
returns bigint                                 -- the new car id
language plpgsql
security definer
set search_path = public
as $$
declare
  s            car_submissions;
  v_class      text;
  v_base       text;
  v_car_id     bigint;
  v_count      int;
  v_tier       text;
begin
  -- Defensive: if called in an authenticated context, require admin. In the
  -- Studio SQL editor auth.uid() is null (service role) and this passes.
  if auth.uid() is not null and not is_admin() then
    raise exception 'not authorised';
  end if;

  select * into s from car_submissions where id = p_id;
  if not found then raise exception 'submission % not found', p_id; end if;
  if s.status <> 'pending' then
    raise exception 'submission % is %, not pending', p_id, s.status;
  end if;

  -- Mint a unique model_class: <year>_<Make>_<Model>, collision-suffixed.
  v_base := trim(both '_' from
    coalesce(_slug_token(s.year_start::text) || '_', '')
    || _slug_token(s.make) || '_' || _slug_token(s.model));
  v_class := v_base;
  if exists (select 1 from cars where model_class = v_class) then
    v_class := v_base || '_' || p_id::text;
  end if;

  insert into cars (make, model, generation, year_start, year_end, body, rarity_tier, model_class)
  values (s.make, s.model, s.generation, s.year_start, s.year_end, s.body, p_rarity, v_class)
  returning id into v_car_id;

  -- Placeholder sprite.
  insert into sprites (car_id, asset_url, is_current)
  values (v_car_id, '/sprites/placeholder/' || v_car_id || '.png', true)
  on conflict do nothing;

  update car_submissions
     set status = 'approved', car_id = v_car_id, model_class = v_class,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  -- Contributor badge by approved-submission count.
  select count(*) into v_count from car_submissions
    where submitted_by = s.submitted_by and status = 'approved';
  v_tier := case
    when v_count >= 20 then 'gold'
    when v_count >= 5  then 'silver'
    else 'bronze'
  end;
  insert into achievements (user_id, kind, tier)
  values (s.submitted_by, 'contributor', v_tier)
  on conflict (user_id, kind, tier) do nothing;

  return v_car_id;
end;
$$;

create or replace function public.reject_submission(p_id bigint, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'not authorised';
  end if;
  update car_submissions
     set status = 'rejected', notes = p_notes,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'submission % not found or not pending', p_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Admin review views (query in the SQL editor as service role).
-- ---------------------------------------------------------------------------
create or replace view admin_pending_submissions as
select
  s.id, s.make, s.model, s.generation, s.year_start, s.year_end, s.body,
  p.handle as submitter,
  (select count(*) from submission_images si where si.submission_id = s.id) as image_count,
  s.created_at
from car_submissions s
join profiles p on p.id = s.submitted_by
where s.status = 'pending'
order by s.created_at;

-- ---------------------------------------------------------------------------
-- 7. Storage bucket for submission images — create + lock down ONCE.
--    Create a PRIVATE bucket named `submissions` (dashboard or the commented
--    call below), then apply the policy so a user can only write under their
--    own uid/ folder. No select/anon policy → reads are service-role only.
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('submissions','submissions',false)
--   on conflict (id) do nothing;
--
-- create policy "users upload to own submission folder"
--   on storage.objects for insert to authenticated
--   with check (
--     bucket_id = 'submissions'
--     and (storage.foldername(name))[1] = (select auth.uid())::text
--   );
