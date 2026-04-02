-- Replace old creator_enabled-based listing permissions
-- Listings.user_id is the owning CreatorHub account id
alter table
  public.listings enable row level security;

drop policy if exists "listings creator insert" on public.listings;

drop policy if exists "listings owner update" on public.listings;

drop policy if exists "listings owner delete" on public.listings;

drop policy if exists "listings approved seller insert" on public.listings;

create policy "listings approved seller insert" on public.listings for
insert
  to authenticated with check (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "listings approved seller update own" on public.listings;

create policy "listings approved seller update own" on public.listings for
update
  to authenticated using (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
  ) with check (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "listings approved seller delete own" on public.listings;

create policy "listings approved seller delete own" on public.listings for delete to authenticated using (
  auth.uid() = user_id
  and public.is_approved_seller(auth.uid())
);