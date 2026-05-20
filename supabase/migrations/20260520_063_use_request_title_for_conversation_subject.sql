-- Prefer the buyer's structured request title as the request conversation subject.
-- Falls back to the frozen listing snapshot title for older/legacy requests.

create or replace function public.create_conversation_for_listing_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  conversation_subject text;
begin
  conversation_subject := left(
    coalesce(
      nullif(btrim(new.request_title), ''),
      nullif(new.listing_snapshot ->> 'title', ''),
      'Listing request'
    ),
    120
  );

  insert into public.conversations (
    conversation_type,
    buyer_user_id,
    creator_user_id,
    created_by_user_id,
    listing_id,
    listing_request_id,
    subject
  )
  values (
    'listing_request',
    new.buyer_user_id,
    new.creator_user_id,
    new.buyer_user_id,
    new.listing_id,
    new.id,
    conversation_subject
  )
  returning id into conversation_id;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role
  )
  values
    (conversation_id, new.buyer_user_id, 'buyer'),
    (conversation_id, new.creator_user_id, 'creator');

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    new.buyer_user_id,
    'conversation_created',
    jsonb_build_object(
      'conversation_type', 'listing_request',
      'listing_request_id', new.id,
      'listing_id', new.listing_id,
      'request_title', new.request_title
    )
  );

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    new.buyer_user_id,
    'request_linked',
    jsonb_build_object(
      'listing_request_id', new.id,
      'request_title', new.request_title
    )
  );

  return new;
end;
$$;

-- Keep existing request conversations aligned with the new subject preference.
update public.conversations
set
  subject = left(
    coalesce(
      nullif(btrim(listing_requests.request_title), ''),
      nullif(listing_requests.listing_snapshot ->> 'title', ''),
      'Listing request'
    ),
    120
  ),
  updated_at = now()
from public.listing_requests
where conversations.listing_request_id = listing_requests.id
  and conversations.conversation_type = 'listing_request';