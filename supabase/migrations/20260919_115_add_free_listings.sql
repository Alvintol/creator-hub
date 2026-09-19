-- Adds support for free listings (a creator giving away a downloadable
-- asset, or a game/build hosted elsewhere) alongside the existing paid
-- listing flow. Free listings never touch Stripe: they either serve a
-- file the creator uploaded, or send the buyer to an external link.

alter table public.listings
  add column if not exists is_free boolean not null default false,
  add column if not exists free_delivery_type text,
  add column if not exists free_external_url text,
  add column if not exists free_file_path text,
  add column if not exists free_file_name text,
  add column if not exists free_file_size_bytes bigint;

alter table public.listings
  drop constraint if exists listings_free_delivery_type_check;

alter table public.listings
  add constraint listings_free_delivery_type_check check (
    free_delivery_type is null
    or free_delivery_type in ('download', 'external_link')
  );

-- A free listing must declare exactly one delivery mechanism, matching its
-- type: a download has a stored file and no external link, an external
-- link has a URL and no stored file. Non-free listings carry none of this.
alter table public.listings
  drop constraint if exists listings_free_delivery_consistency;

alter table public.listings
  add constraint listings_free_delivery_consistency check (
    (
      not is_free
      and free_delivery_type is null
      and free_external_url is null
      and free_file_path is null
    )
    or (
      is_free
      and free_delivery_type = 'download'
      and free_file_path is not null
      and free_external_url is null
    )
    or (
      is_free
      and free_delivery_type = 'external_link'
      and free_external_url is not null
      and free_file_path is null
    )
  );

create index if not exists listings_is_free_idx
  on public.listings (is_free)
  where is_free;

-- Public bucket: free listings are meant to be grabbed by anyone, signed in
-- or not, so objects are readable without a Stripe/auth gate. Creators can
-- only write inside their own auth.uid() folder.
insert into storage.buckets (id, name, public)
values ('free-assets', 'free-assets', true)
on conflict (id) do nothing;

drop policy if exists "free assets creator upload" on storage.objects;
create policy "free assets creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'free-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "free assets creator update own" on storage.objects;
create policy "free assets creator update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'free-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "free assets creator delete own" on storage.objects;
create policy "free assets creator delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'free-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "free assets public read" on storage.objects;
create policy "free assets public read" on storage.objects
  for select to public
  using (bucket_id = 'free-assets');
