alter table public.seller_applications enable row level security;

drop policy if exists "seller applications read own" on public.seller_applications;
drop policy if exists "seller applications insert own" on public.seller_applications;
drop policy if exists "seller applications update own editable states" on public.seller_applications;
drop policy if exists "seller applications read admin" on public.seller_applications;
drop policy if exists "seller applications update admin" on public.seller_applications;

create policy "seller applications read own"
on public.seller_applications
for select
to authenticated
using (auth.uid() = profile_user_id);

create policy "seller applications read admin"
on public.seller_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_roles admin_role
    where admin_role.profile_user_id = auth.uid()
      and admin_role.role = 'admin'
  )
);

create policy "seller applications insert own draft"
on public.seller_applications
for insert
to authenticated
with check (
  auth.uid() = profile_user_id
  and status = 'draft'
);

create policy "seller applications update own draft flow"
on public.seller_applications
for update
to authenticated
using (
  auth.uid() = profile_user_id
  and status in ('draft', 'needs_changes')
)
with check (
  auth.uid() = profile_user_id
  and status in ('draft', 'submitted')
);

create policy "seller applications update admin"
on public.seller_applications
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_roles admin_role
    where admin_role.profile_user_id = auth.uid()
      and admin_role.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.admin_roles admin_role
    where admin_role.profile_user_id = auth.uid()
      and admin_role.role = 'admin'
  )
);