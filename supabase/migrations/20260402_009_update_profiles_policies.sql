-- Remove old creator/twitch-specific profile update gating
-- Keep simple ownership-based profile policies
alter table
  public.profiles enable row level security;

drop policy if exists "profiles readable by everyone" on public.profiles;

create policy "profiles readable by everyone" on public.profiles for
select
  using (true);

drop policy if exists "profiles update own" on public.profiles;

create policy "profiles update own" on public.profiles for
update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can insert their profile" on public.profiles;

create policy "users can insert their profile" on public.profiles for
insert
  to authenticated with check (auth.uid() = user_id);