-- Logs listing request status changes into the linked request conversation.
-- Also adds visible system messages for accepted/archived/submitted changes.
-- Declined requests already create a close event + system message in migration 038.

do $$
declare
  v_constraint_definition text;
begin
  select pg_get_constraintdef(c.oid)
  into v_constraint_definition
  from pg_constraint c
  where c.conrelid = 'public.conversation_events'::regclass
    and c.conname = 'conversation_events_type_check';

  if v_constraint_definition is null then
    raise exception 'conversation_events_type_check constraint was not found.';
  end if;

  if position('request_status_updated' in v_constraint_definition) > 0 then
    return;
  end if;

  alter table public.conversation_events
    drop constraint conversation_events_type_check;

  execute format(
    'alter table public.conversation_events add constraint conversation_events_type_check %s',
    regexp_replace(
      v_constraint_definition,
      '\)\s*$',
      ' OR (event_type = ''request_status_updated''::text))'
    )
  );
end;
$$;

create or replace function public.log_listing_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  actor_id uuid;
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

  actor_id := coalesce(auth.uid(), new.creator_user_id);
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
        'creator_status_reason', safe_reason
      )
    )
  );

  system_message_body := case new.status
    when 'accepted' then 'Request accepted by the creator.'
    when 'archived' then 'Request archived.'
    when 'submitted' then 'Request moved back to under review.'
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
      new.creator_user_id,
      'system',
      system_message_body
    );
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_log_status_change
on public.listing_requests;

create trigger listing_requests_log_status_change
after update of status
on public.listing_requests
for each row
execute function public.log_listing_request_status_change();