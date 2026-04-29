-- Requires additional close details when a conversation is ended with reason "Other".

alter table public.conversations
drop constraint if exists conversations_closed_reason_other_details_check;

alter table public.conversations
add constraint conversations_closed_reason_other_details_check
check (
  closed_reason_code is distinct from 'other'
  or (
    closed_reason_details is not null
    and char_length(btrim(closed_reason_details)) >= 10
  )
);


create or replace function public.close_conversation(
  p_conversation_id uuid,
  p_reason_code text,
  p_reason_details text default null
)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  conversation_row public.conversations;
  details text;
begin
  current_user_id := auth.uid();
  details := nullif(btrim(coalesce(p_reason_details, '')), '');

  if current_user_id is null then
    raise exception 'You must be signed in to close a conversation.';
  end if;

  select *
  into conversation_row
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if not public.is_conversation_participant(p_conversation_id, current_user_id) then
    raise exception 'You do not have access to this conversation.';
  end if;

  if conversation_row.status <> 'open' then
    raise exception 'Only open conversations can be closed.';
  end if;

  if p_reason_code is null
    or not (
      p_reason_code = any (
        array[
          'question_answered'::text,
          'not_moving_forward'::text,
          'not_a_fit'::text,
          'duplicate_conversation'::text,
          'unresponsive'::text,
          'unwanted_messages'::text,
          'other'::text
        ]
      )
    )
  then
    raise exception 'Please choose a valid reason for ending the conversation.';
  end if;

  if p_reason_code = 'other' and (details is null or char_length(details) < 10) then
    raise exception 'Please add at least 10 characters of detail when choosing Other.';
  end if;

  if details is not null and char_length(details) > 1000 then
    raise exception 'Additional details must be 1000 characters or less.';
  end if;

  update public.conversations
  set
    status = 'closed',
    closed_at = now(),
    closed_by_user_id = current_user_id,
    closed_reason_code = p_reason_code,
    closed_reason_details = details,
    updated_at = now()
  where id = p_conversation_id
  returning * into conversation_row;

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
  values (
    p_conversation_id,
    current_user_id,
    'system',
    'Conversation ended.'
  );

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    p_conversation_id,
    current_user_id,
    'conversation_closed',
    jsonb_build_object(
      'reason_code', p_reason_code,
      'reason_details', details
    )
  );

  return conversation_row;
end;
$$;

grant execute on function public.close_conversation(uuid, text, text)
to authenticated;