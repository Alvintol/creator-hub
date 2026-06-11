alter table public.conversations
drop constraint if exists conversations_closed_reason_code_check;

alter table public.conversations
add constraint conversations_closed_reason_code_check
check (
  closed_reason_code is null
  or closed_reason_code = any (
    array[
      'question_answered'::text,
      'not_moving_forward'::text,
      'not_a_fit'::text,
      'duplicate_conversation'::text,
      'unresponsive'::text,
      'unwanted_messages'::text,
      'project_completed'::text,
      'other'::text
    ]
  )
);

create or replace function
public.close_conversation_when_listing_request_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;

  completion_time timestamptz :=
    coalesce(new.completed_at, now());

  completion_actor_user_id uuid :=
    coalesce(
      new.completed_by_user_id,
      new.buyer_user_id
    );
begin
  if old.status is not distinct from new.status
    or new.status <> 'completed' then
    return new;
  end if;

  select *
  into conversation_row
  from public.conversations
  where conversations.listing_request_id = new.id
  for update;

  if not found then
    return new;
  end if;

  -- Closed and admin-locked conversations are already read-only.
  if conversation_row.status <> 'open' then
    return new;
  end if;

  update public.conversations
  set
    status = 'closed',
    closed_at = completion_time,
    closed_by_user_id =
      completion_actor_user_id,
    closed_reason_code =
      'project_completed',
    closed_reason_details =
      'The buyer approved the final delivery.',
    updated_at = now()
  where conversations.id =
    conversation_row.id;

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
  values (
    conversation_row.id,
    completion_actor_user_id,
    'system',
    'The buyer approved the final delivery. The project is complete and this conversation is now read-only.'
  );

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_row.id,
    completion_actor_user_id,
    'conversation_closed',
    jsonb_build_object(
      'reason_code',
        'project_completed',
      'reason_details',
        'The buyer approved the final delivery.',
      'listing_request_id',
        new.id,
      'request_status',
        new.status,
      'completed_at',
        completion_time
    )
  );

  return new;
end;
$$;

drop trigger if exists
listing_requests_close_conversation_when_completed
on public.listing_requests;

create trigger
listing_requests_close_conversation_when_completed
after update of status
on public.listing_requests
for each row
when (
  old.status is distinct from new.status
  and new.status = 'completed'
)
execute function
public.close_conversation_when_listing_request_completed();

-- Backfill completed projects whose conversations are still open.
do $$
declare
  completed_conversation record;
begin
  for completed_conversation in
    select
      conversations.id as conversation_id,
      listing_requests.id as listing_request_id,
      coalesce(
        listing_requests.completed_by_user_id,
        listing_requests.buyer_user_id
      ) as actor_user_id,
      coalesce(
        listing_requests.completed_at,
        now()
      ) as completed_at
    from public.listing_requests
    inner join public.conversations
      on conversations.listing_request_id =
        listing_requests.id
    where listing_requests.status = 'completed'
      and conversations.status = 'open'
    for update of conversations
  loop
    update public.conversations
    set
      status = 'closed',
      closed_at =
        completed_conversation.completed_at,
      closed_by_user_id =
        completed_conversation.actor_user_id,
      closed_reason_code =
        'project_completed',
      closed_reason_details =
        'The buyer approved the final delivery.',
      updated_at = now()
    where conversations.id =
      completed_conversation.conversation_id;

    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      completed_conversation.conversation_id,
      completed_conversation.actor_user_id,
      'system',
      'The buyer approved the final delivery. The project is complete and this conversation is now read-only.'
    );

    insert into public.conversation_events (
      conversation_id,
      actor_user_id,
      event_type,
      metadata
    )
    values (
      completed_conversation.conversation_id,
      completed_conversation.actor_user_id,
      'conversation_closed',
      jsonb_build_object(
        'reason_code',
          'project_completed',
        'reason_details',
          'The buyer approved the final delivery.',
        'listing_request_id',
          completed_conversation.listing_request_id,
        'request_status',
          'completed',
        'completed_at',
          completed_conversation.completed_at
      )
    );
  end loop;
end;
$$;