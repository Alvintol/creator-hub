alter table public.listings
add column fulfilment_mode text not null default 'request';

alter table public.listings
add constraint listings_fulfilment_mode_check
check (
  fulfilment_mode = any (
    array['request'::text, 'instant'::text]
  )
);

-- Safety-first backfill:
-- keep all existing listings in request mode unless creators explicitly change them later
update public.listings
set fulfilment_mode = 'request'
where fulfilment_mode is distinct from 'request';

create index if not exists listings_fulfilment_mode_idx
on public.listings using btree (fulfilment_mode);

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
      'fulfilment_mode', new.fulfilment_mode,
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