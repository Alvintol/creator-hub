-- Tracks who archived/cancelled a listing request.
-- This lets request list/detail UI distinguish buyer-cancelled requests
-- from creator-archived requests without reading conversation events.

alter table public.listing_requests
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by_user_id uuid null;

-- Backfill timestamp only for existing archived rows.
-- archived_by_user_id is intentionally left null for historical rows because
-- older rows do not reliably tell us who performed the archive.
update public.listing_requests
set archived_at = coalesce(archived_at, updated_at, now())
where status = 'archived'
  and archived_at is null;

create or replace function public.set_listing_request_archive_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'archived' then
      new.archived_at := coalesce(new.archived_at, now());
      new.archived_by_user_id := coalesce(new.archived_by_user_id, auth.uid());
    else
      new.archived_at := null;
      new.archived_by_user_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_set_archive_metadata
on public.listing_requests;

create trigger listing_requests_set_archive_metadata
before update of status
on public.listing_requests
for each row
execute function public.set_listing_request_archive_metadata();

-- Refresh the status-change logger so archive messages can fall back to the
-- persisted archive actor if auth.uid() is unavailable in a future server path.
create or replace function public.log_listing_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  actor_id uuid;
  archive_actor_id uuid;
  system_message_body text;
  safe_reason text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = new.id
  limit 1;

  if conversation_id is null then
    return new;
  end if;

  archive_actor_id := coalesce(new.archived_by_user_id, auth.uid());
  actor_id := coalesce(auth.uid(), new.archived_by_user_id, new.creator_user_id);
  safe_reason := nullif(btrim(coalesce(new.creator_status_reason, '')), '');

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    actor_id,
    'request_status_updated',
    jsonb_strip_nulls(
      jsonb_build_object(
        'listing_request_id', new.id,
        'listing_id', new.listing_id,
        'previous_status', old.status,
        'new_status', new.status,
        'request_title', new.request_title,
        'creator_status_reason', safe_reason,
        'archived_at', new.archived_at,
        'archived_by_user_id', new.archived_by_user_id
      )
    )
  );

  system_message_body := case
    when new.status = 'accepted' then
      'Request accepted by the creator.'

    when new.status = 'archived' and archive_actor_id = new.buyer_user_id then
      'Request cancelled by the buyer.'

    when new.status = 'archived' and archive_actor_id = new.creator_user_id then
      'Request archived by the creator.'

    when new.status = 'archived' then
      'Request archived.'

    when new.status = 'submitted' then
      'Request moved back to under review.'

    else null
  end;

  -- Declined requests already get a clearer close message from the existing
  -- close_conversation_when_listing_request_declined trigger.
  if system_message_body is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      conversation_id,
      actor_id,
      'system',
      system_message_body
    );
  end if;

  return new;
end;
$$;