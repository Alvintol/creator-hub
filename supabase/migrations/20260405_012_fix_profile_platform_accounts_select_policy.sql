-- Allows signed-in users to read and manage only their own linked platform rows

grant select, update, delete on table public.profile_platform_accounts to authenticated;

alter table public.profile_platform_accounts enable row level security;

drop policy if exists "profile_platform_accounts_select_own"
on public.profile_platform_accounts;

create policy "profile_platform_accounts_select_own"
on public.profile_platform_accounts
for select
to authenticated
using (profile_user_id = auth.uid());

drop policy if exists "profile_platform_accounts_update_own"
on public.profile_platform_accounts;

create policy "profile_platform_accounts_update_own"
on public.profile_platform_accounts
for update
to authenticated
using (profile_user_id = auth.uid())
with check (profile_user_id = auth.uid());

drop policy if exists "profile_platform_accounts_delete_own"
on public.profile_platform_accounts;

create policy "profile_platform_accounts_delete_own"
on public.profile_platform_accounts
for delete
to authenticated
using (profile_user_id = auth.uid());