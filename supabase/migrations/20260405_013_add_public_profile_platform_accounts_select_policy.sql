-- Allows public creator pages to read linked platform rows
-- for profiles that have a public handle.
-- This is separate from the signed-in "read your own rows" policy.
grant
select
  on table public.profile_platform_accounts to anon,
  authenticated;

alter table
  public.profile_platform_accounts enable row level security;

drop policy if exists "profile_platform_accounts_select_public_creator_profiles" on public.profile_platform_accounts;

create policy "profile_platform_accounts_select_public_creator_profiles" on public.profile_platform_accounts for
select
  to anon,
  authenticated using (
    exists (
      select
        1
      from
        public.profiles
      where
        profiles.user_id = profile_platform_accounts.profile_user_id
        and profiles.handle is not null
    )
  );