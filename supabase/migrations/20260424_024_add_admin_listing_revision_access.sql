drop policy if exists "listings admin read" on public.listings;

create policy "listings admin read"
on public.listings
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
      and admin_roles.role = 'admin'
  )
);

drop policy if exists "listing revisions admin select" on public.listing_revisions;

create policy "listing revisions admin select"
on public.listing_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
      and admin_roles.role = 'admin'
  )
);