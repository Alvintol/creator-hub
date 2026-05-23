-- Makes archived request system messages clearer by distinguishing
-- buyer-cancelled requests from creator-archived requests.

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

  system_message_body := case
    when new.status = 'accepted' then
      'Request accepted by the creator.'

    when new.status = 'archived' and actor_id = new.buyer_user_id then
      'Request cancelled by the buyer.'

    when new.status = 'archived' and actor_id = new.creator_user_id then
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