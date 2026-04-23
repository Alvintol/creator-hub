create table public.listing_revisions (
  id bigint generated always as identity primary key,
  listing_id uuid not null,
  actor_user_id uuid null,
  event_type text not null,
  snapshot jsonb not null,
  created_at timestamp with time zone not null default now(),
  constraint listing_revisions_event_type_check check (
    event_type = any (
      array[
        'created'::text,
        'updated'::text,
        'published'::text,
        'deactivated'::text,
        'reactivated'::text,
        'moved_to_draft'::text
      ]
    )
  )
);

create index listing_revisions_listing_id_idx
  on public.listing_revisions (listing_id, created_at desc);

alter table public.listing_revisions enable row level security;

create policy "listing revisions owner select"
on public.listing_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.listings
    where listings.id = listing_revisions.listing_id
      and listings.user_id = auth.uid()
  )
);

create or replace function public.capture_listing_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_event_type text;
begin
  if tg_op = 'INSERT' then
    next_event_type := 'created';
  else
    if old.status = 'draft'
      and new.status = 'published'
      and new.is_active = true then
      next_event_type := 'published';

    elsif old.status = 'published'
      and old.is_active = true
      and new.status = 'published'
      and new.is_active = false then
      next_event_type := 'deactivated';

    elsif old.status = 'published'
      and old.is_active = false
      and new.status = 'published'
      and new.is_active = true then
      next_event_type := 'reactivated';

    elsif old.status = 'published'
      and new.status = 'draft'
      and new.is_active = false then
      next_event_type := 'moved_to_draft';

    else
      next_event_type := 'updated';
    end if;
  end if;

  insert into public.listing_revisions (
    listing_id,
    actor_user_id,
    event_type,
    snapshot
  )
  values (
    new.id,
    auth.uid(),
    next_event_type,
    jsonb_build_object(
      'id', new.id,
      'user_id', new.user_id,
      'title', new.title,
      'short', new.short,
      'offering_type', new.offering_type,
      'category', new.category,
      'video_subtype', new.video_subtype,
      'price_type', new.price_type,
      'price_min', new.price_min,
      'price_max', new.price_max,
      'deliverables', new.deliverables,
      'tags', new.tags,
      'preview_url', new.preview_url,
      'status', new.status,
      'is_active', new.is_active,
      'created_at', new.created_at,
      'updated_at', new.updated_at
    )
  );

  return new;
end;
$$;

drop trigger if exists listings_capture_revision on public.listings;

create trigger listings_capture_revision
after insert or update on public.listings
for each row
execute function public.capture_listing_revision();