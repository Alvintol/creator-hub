-- RLS for linked platform accounts
alter table
  public.profile_platform_accounts enable row level security;

drop policy if exists "platform accounts read own" on public.profile_platform_accounts;

create policy "platform accounts read own" on public.profile_platform_accounts for
select
  to authenticated using (auth.uid() = profile_user_id);

drop policy if exists "platform accounts insert own" on public.profile_platform_accounts;

create policy "platform accounts insert own" on public.profile_platform_accounts for
insert
  to authenticated with check (auth.uid() = profile_user_id);

drop policy if exists "platform accounts update own" on public.profile_platform_accounts;

create policy "platform accounts update own" on public.profile_platform_accounts for
update
  to authenticated using (auth.uid() = profile_user_id) with check (auth.uid() = profile_user_id);

drop policy if exists "platform accounts delete own" on public.profile_platform_accounts;

create policy "platform accounts delete own" on public.profile_platform_accounts for delete to authenticated using (auth.uid() = profile_user_id);