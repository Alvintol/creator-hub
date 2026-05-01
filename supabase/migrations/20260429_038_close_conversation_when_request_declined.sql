-- Automatically closes the linked conversation when a creator declines a request.
-- This keeps declined request conversations read-only and prevents image permission changes.

create or replace function public.close_conversation_when_listing_request_declined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations;
  decline_details text;
begin
  if new.status <> 'declined' then
    return new;
  end if;

  if old.status = 'declined' then
    return new;
  end if;

  decline_details := nullif(btrim(coalesce(new.creator_status_reason, '')), '');

  if decline_details is null or char_length(decline_details) < 10 then
    raise exception 'A decline reason is required before closing the conversation.';
  end if;

  select *
  into conversation_row
  from public.conversations
  where listing_request_id = new.id
  for update;

  if not found then
    raise exception 'Conversation not found for declined request.';
  end if;

  if conversation_row.status <> 'open' then
    return new;
  end if;

  update public.conversations
  set
    status = 'closed',
    closed_at = now(),
    closed_by_user_id = new.creator_user_id,
    closed_reason_code = 'not_moving_forward',
    closed_reason_details = decline_details,
    updated_at = now()
  where id = conversation_row.id;

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
  values (
    conversation_row.id,
    new.creator_user_id,
    'system',
    'Conversation ended because the request was declined.'
  );

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_row.id,
    new.creator_user_id,
    'conversation_closed',
    jsonb_build_object(
      'reason_code', 'not_moving_forward',
      'reason_details', decline_details,
      'listing_request_id', new.id,
      'request_status', new.status
    )
  );

  return new;
end;
$$;

drop trigger if exists listing_requests_close_conversation_when_declined
on public.listing_requests;

create trigger listing_requests_close_conversation_when_declined
after update of status on public.listing_requests
for each row
execute function public.close_conversation_when_listing_request_declined();