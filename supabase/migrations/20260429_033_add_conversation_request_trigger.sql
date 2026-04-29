-- Automatically creates a linked conversation when a formal listing request is created.
-- Also backfills conversations for existing listing_requests.

create or replace function public.create_conversation_for_listing_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  listing_title text;
begin
  listing_title := left(
    coalesce(nullif(new.listing_snapshot ->> 'title', ''), 'Listing request'),
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
    listing_title
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
      'listing_id', new.listing_id
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
      'listing_request_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists listing_requests_create_conversation
on public.listing_requests;

create trigger listing_requests_create_conversation
after insert on public.listing_requests
for each row
execute function public.create_conversation_for_listing_request();


with inserted_conversations as (
  insert into public.conversations (
    conversation_type,
    buyer_user_id,
    creator_user_id,
    created_by_user_id,
    listing_id,
    listing_request_id,
    subject,
    created_at,
    updated_at
  )
  select
    'listing_request',
    listing_requests.buyer_user_id,
    listing_requests.creator_user_id,
    listing_requests.buyer_user_id,
    listing_requests.listing_id,
    listing_requests.id,
    left(
      coalesce(
        nullif(listing_requests.listing_snapshot ->> 'title', ''),
        'Listing request'
      ),
      120
    ),
    listing_requests.created_at,
    listing_requests.updated_at
  from public.listing_requests
  where not exists (
    select 1
    from public.conversations
    where conversations.listing_request_id = listing_requests.id
  )
  returning
    id,
    buyer_user_id,
    creator_user_id,
    created_by_user_id,
    listing_request_id,
    listing_id
),

inserted_participants as (
  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role
  )
  select
    inserted_conversations.id,
    inserted_conversations.buyer_user_id,
    'buyer'
  from inserted_conversations

  union all

  select
    inserted_conversations.id,
    inserted_conversations.creator_user_id,
    'creator'
  from inserted_conversations

  on conflict do nothing
  returning 1
),

inserted_created_events as (
  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  select
    inserted_conversations.id,
    inserted_conversations.created_by_user_id,
    'conversation_created',
    jsonb_build_object(
      'conversation_type', 'listing_request',
      'listing_request_id', inserted_conversations.listing_request_id,
      'listing_id', inserted_conversations.listing_id
    )
  from inserted_conversations
  returning 1
)

insert into public.conversation_events (
  conversation_id,
  actor_user_id,
  event_type,
  metadata
)
select
  inserted_conversations.id,
  inserted_conversations.created_by_user_id,
  'request_linked',
  jsonb_build_object(
    'listing_request_id', inserted_conversations.listing_request_id
  )
from inserted_conversations;