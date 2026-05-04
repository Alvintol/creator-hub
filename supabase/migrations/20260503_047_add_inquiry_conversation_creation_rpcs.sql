-- Adds controlled inquiry conversation creation RPCs.
-- Clients should not directly insert creator/listing inquiry conversations.

create or replace function public.conversation_initiation_reason_label(
  p_reason_code text
)
returns text
language sql
stable
as $$
  select
    case p_reason_code
      when 'custom_quote' then 'Custom quote'
      when 'style_fit' then 'Style fit or creative direction'
      when 'scope_or_complexity' then 'Scope or complexity'
      when 'timeline_availability' then 'Timeline or availability'
      when 'pricing' then 'Pricing question'
      when 'deliverables' then 'Deliverables question'
      when 'usage_rights' then 'Usage rights or licensing'
      when 'reference_requirements' then 'Reference image or material requirements'
      when 'revision_policy' then 'Revision policy'
      when 'commercial_use' then 'Commercial-use question'
      when 'file_formats' then 'File format or source-file question'
      when 'bundle_or_multiple_items' then 'Bundle or multiple item request'
      when 'commission_availability' then 'Commission availability'
      when 'listing_clarification' then 'Clarification about a listing'
      when 'before_requesting' then 'Question before submitting a request'
      else null
    end;
$$;


create or replace function public.is_valid_conversation_initiation_reason(
  p_reason_code text
)
returns boolean
language sql
stable
as $$
  select p_reason_code = any (
    array[
      'custom_quote'::text,
      'style_fit'::text,
      'scope_or_complexity'::text,
      'timeline_availability'::text,
      'pricing'::text,
      'deliverables'::text,
      'usage_rights'::text,
      'reference_requirements'::text,
      'revision_policy'::text,
      'commercial_use'::text,
      'file_formats'::text,
      'bundle_or_multiple_items'::text,
      'commission_availability'::text,
      'listing_clarification'::text,
      'before_requesting'::text
    ]
  );
$$;


create or replace function public.create_creator_inquiry_conversation(
  p_creator_user_id uuid,
  p_initiation_reason_code text,
  p_initial_message text
)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  topic_label text;
  trimmed_message text;
  conversation_row public.conversations;
  message_created_at timestamp with time zone;
begin
  current_user_id := auth.uid();
  trimmed_message := nullif(btrim(coalesce(p_initial_message, '')), '');
  topic_label := public.conversation_initiation_reason_label(p_initiation_reason_code);

  if current_user_id is null then
    raise exception 'You must be signed in to start a conversation.';
  end if;

  if p_creator_user_id is null then
    raise exception 'Creator is required.';
  end if;

  if current_user_id = p_creator_user_id then
    raise exception 'You cannot start a conversation with yourself.';
  end if;

  if not public.is_valid_conversation_initiation_reason(p_initiation_reason_code) then
    raise exception 'Please choose a valid conversation topic.';
  end if;

  if topic_label is null then
    raise exception 'Please choose a valid conversation topic.';
  end if;

  if trimmed_message is null or char_length(trimmed_message) < 10 then
    raise exception 'Message must be at least 10 characters.';
  end if;

  if char_length(trimmed_message) > 2000 then
    raise exception 'Message must be 2000 characters or less.';
  end if;

  if not public.is_approved_seller(p_creator_user_id) then
    raise exception 'This creator is not currently available for messages.';
  end if;

  insert into public.conversations (
    conversation_type,
    buyer_user_id,
    creator_user_id,
    created_by_user_id,
    listing_id,
    listing_request_id,
    subject,
    initiation_reason_code,
    status
  )
  values (
    'creator_inquiry',
    current_user_id,
    p_creator_user_id,
    current_user_id,
    null,
    null,
    topic_label,
    p_initiation_reason_code,
    'open'
  )
  returning * into conversation_row;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    last_read_at
  )
  values
    (conversation_row.id, current_user_id, 'buyer', now()),
    (conversation_row.id, p_creator_user_id, 'creator', null);

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
  values (
    conversation_row.id,
    current_user_id,
    'text',
    trimmed_message
  )
  returning created_at into message_created_at;

  update public.conversations
  set
    last_message_at = message_created_at,
    last_message_sender_user_id = current_user_id,
    last_message_preview = left(trimmed_message, 180),
    updated_at = message_created_at
  where id = conversation_row.id
  returning * into conversation_row;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_row.id,
    current_user_id,
    'conversation_created',
    jsonb_build_object(
      'conversation_type', 'creator_inquiry',
      'initiation_reason_code', p_initiation_reason_code
    )
  );

  return conversation_row;
end;
$$;


create or replace function public.create_listing_inquiry_conversation(
  p_listing_id uuid,
  p_initiation_reason_code text,
  p_initial_message text
)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  listing_owner_user_id uuid;
  topic_label text;
  trimmed_message text;
  conversation_row public.conversations;
  message_created_at timestamp with time zone;
begin
  current_user_id := auth.uid();
  trimmed_message := nullif(btrim(coalesce(p_initial_message, '')), '');
  topic_label := public.conversation_initiation_reason_label(p_initiation_reason_code);

  if current_user_id is null then
    raise exception 'You must be signed in to start a conversation.';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required.';
  end if;

  if not public.is_valid_conversation_initiation_reason(p_initiation_reason_code) then
    raise exception 'Please choose a valid conversation topic.';
  end if;

  if topic_label is null then
    raise exception 'Please choose a valid conversation topic.';
  end if;

  if trimmed_message is null or char_length(trimmed_message) < 10 then
    raise exception 'Message must be at least 10 characters.';
  end if;

  if char_length(trimmed_message) > 2000 then
    raise exception 'Message must be 2000 characters or less.';
  end if;

  select listings.user_id
  into listing_owner_user_id
  from public.listings
  where listings.id = p_listing_id
    and listings.status = 'published'
    and listings.is_active = true;

  if not found then
    raise exception 'Listing is not available for messages.';
  end if;

  if current_user_id = listing_owner_user_id then
    raise exception 'You cannot start a conversation with yourself.';
  end if;

  insert into public.conversations (
    conversation_type,
    buyer_user_id,
    creator_user_id,
    created_by_user_id,
    listing_id,
    listing_request_id,
    subject,
    initiation_reason_code,
    status
  )
  values (
    'listing_inquiry',
    current_user_id,
    listing_owner_user_id,
    current_user_id,
    p_listing_id,
    null,
    topic_label,
    p_initiation_reason_code,
    'open'
  )
  returning * into conversation_row;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    last_read_at
  )
  values
    (conversation_row.id, current_user_id, 'buyer', now()),
    (conversation_row.id, listing_owner_user_id, 'creator', null);

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
  values (
    conversation_row.id,
    current_user_id,
    'text',
    trimmed_message
  )
  returning created_at into message_created_at;

  update public.conversations
  set
    last_message_at = message_created_at,
    last_message_sender_user_id = current_user_id,
    last_message_preview = left(trimmed_message, 180),
    updated_at = message_created_at
  where id = conversation_row.id
  returning * into conversation_row;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_row.id,
    current_user_id,
    'conversation_created',
    jsonb_build_object(
      'conversation_type', 'listing_inquiry',
      'listing_id', p_listing_id,
      'initiation_reason_code', p_initiation_reason_code
    )
  );

  return conversation_row;
end;
$$;


grant execute on function public.create_creator_inquiry_conversation(
  uuid,
  text,
  text
)
to authenticated;

grant execute on function public.create_listing_inquiry_conversation(
  uuid,
  text,
  text
)
to authenticated;