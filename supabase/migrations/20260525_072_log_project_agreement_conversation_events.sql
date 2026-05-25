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

  if position('project_agreement_sent' in v_constraint_definition) = 0 then
    alter table public.conversation_events
      drop constraint conversation_events_type_check;

    execute format(
      'alter table public.conversation_events add constraint conversation_events_type_check %s',
      regexp_replace(
        v_constraint_definition,
        '\)\s*$',
        ' OR (event_type = ''project_agreement_sent''::text) OR (event_type = ''project_agreement_response''::text))'
      )
    );
  end if;
end;
$$;

create or replace function public.log_listing_request_agreement_conversation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  actor_id uuid;
  system_message_body text;
  event_type_value text;
begin
  if tg_op = 'INSERT' and new.status <> 'sent' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.status not in ('sent', 'buyer_accepted', 'buyer_declined')
  then
    return new;
  end if;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = new.listing_request_id
  limit 1;

  if conversation_id is null then
    return new;
  end if;

  actor_id := case
    when new.status in ('buyer_accepted', 'buyer_declined') then new.buyer_user_id
    else new.creator_user_id
  end;

  event_type_value := case
    when new.status = 'sent' then 'project_agreement_sent'
    else 'project_agreement_response'
  end;

  system_message_body := case
    when new.status = 'sent' then 'Project agreement sent for buyer review.'
    when new.status = 'buyer_accepted' then 'Project agreement accepted by the buyer.'
    when new.status = 'buyer_declined' then 'Project agreement declined by the buyer.'
    else null
  end;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    actor_id,
    event_type_value,
    jsonb_strip_nulls(
      jsonb_build_object(
        'listing_request_id', new.listing_request_id,
        'agreement_id', new.id,
        'agreement_status', new.status,
        'version_number', new.version_number,
        'payment_structure', new.payment_structure,
        'starting_payment_status', new.starting_payment_status,
        'currency', new.currency,
        'total_amount', new.total_amount,
        'deposit_amount', new.deposit_amount,
        'estimated_completion_at', new.estimated_completion_at,
        'adjusted_estimated_completion_at', new.adjusted_estimated_completion_at
      )
    )
  );

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

drop trigger if exists listing_request_agreements_log_insert
on public.listing_request_agreements;

create trigger listing_request_agreements_log_insert
after insert
on public.listing_request_agreements
for each row
execute function public.log_listing_request_agreement_conversation_event();

drop trigger if exists listing_request_agreements_log_status_update
on public.listing_request_agreements;

create trigger listing_request_agreements_log_status_update
after update of status
on public.listing_request_agreements
for each row
execute function public.log_listing_request_agreement_conversation_event();