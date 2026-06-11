-- =============================================================================
-- CarDex — auto-create profiles on signup
-- Root cause of "settings won't persist": there was no profiles row for the
-- user, so `update profiles ... where id = auth.uid()` matched 0 rows (no error,
-- no write). This adds the standard trigger that creates a profile when an
-- auth.users row is inserted, and backfills any existing users missing one.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    -- email local-part + short uuid suffix → readable + collision-safe.
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'trainer')
      || '_' || substr(new.id::text, 1, 8)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users who signed up before the trigger existed.
insert into public.profiles (id, handle)
select
  u.id,
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'trainer')
    || '_' || substr(u.id::text, 1, 8)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
