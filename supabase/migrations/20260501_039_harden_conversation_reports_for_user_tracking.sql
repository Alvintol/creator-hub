-- Hardens conversation reports so admins can reliably track:
-- - reports made against a user
-- - reports created by a user
-- - duplicate/malicious reporting patterns
--
-- Important:
-- The frontend should no longer insert directly into conversation_reports.
-- It should call public.submit_conversation_report(...), which derives reported_user_id.

-- Backfill any existing reports that may not have reported_user_id set.
update public.conversation_reports
set reported_user_id = conversation_messages.sender_user_id
from public.conversation_messages
where conversation_reports.message_id = conversation_messages.id
  and conversation_reports.reported_user_id is null;

update public.conversation_reports
set reported_user_id =
  case
    when conversation_reports.reporter_user_id = conversations.buyer_user_id
      then conversations.creator_user_id
    when conversation_reports.reporter_user_id = conversations.creator_user_id
      then conversations.buyer_user_id
    else conversation_reports.reported_user_id
  end
from public.conversations
where conversation_reports.conversation_id = conversations.id
  and conversation_reports.message_id is null
  and conversation_reports.reported_user_id is null;

-- Remove exact duplicate reports by the same reporter against the same conversation.
with duplicate_conversation_reports as (
  select
    id,
    row_number() over (
      partition by conversation_id, reporter_user_id
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.conversation_reports
  where message_id is null
)
delete from public.conversation_reports
using duplicate_conversation_reports
where conversation_reports.id = duplicate_conversation_reports.id
  and duplicate_conversation_reports.duplicate_rank > 1;

-- Remove exact duplicate reports by the same reporter against the same message.
with duplicate_message_reports as (
  select
    id,
    row_number() over (
      partition by message_id, reporter_user_id
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.conversation_reports
  where message_id is not null
)
delete from public.conversation_reports
using duplicate_message_reports
where conversation_reports.id = duplicate_message_reports.id
  and duplicate_message_reports.duplicate_rank > 1;

alter table public.conversation_reports
alter column reported_user_id set not null;

alter table public.conversation_reports
drop constraint if exists conversation_reports_reporter_reported_check;

alter table public.conversation_reports
add constraint conversation_reports_reporter_reported_check
check (reporter_user_id <> reported_user_id);

create unique index if not exists conversation_reports_unique_conversation_reporter_idx
on public.conversation_reports (
  conversation_id,
  reporter_user_id
)
where message_id is null;

create unique index if not exists conversation_reports_unique_message_reporter_idx
on public.conversation_reports (
  message_id,
  reporter_user_id
)
where message_id is not null;

create index if not exists conversation_reports_reported_user_status_created_at_idx
on public.conversation_reports using btree (
  reported_user_id,
  status,
  created_at desc
);

create index if not exists conversation_reports_reporter_status_created_at_idx
on public.conversation_reports using btree (
  reporter_user_id,
  status,
  created_at desc
);

create index if not exists conversation_reports_reported_user_reason_created_at_idx
on public.conversation_reports using btree (
  reported_user_id,
  reason_code,
  created_at desc
);

create index if not exists conversation_reports_reporter_reason_created_at_idx
on public.conversation_reports using btree (
  reporter_user_id,
  reason_code,
  created_at desc
);

-- Stop direct report inserts from the client.
drop policy if exists "conversation reports participants insert"
on public.conversation_reports;

revoke insert on public.conversation_reports from authenticated;

create or replace function public.submit_conversation_report(
  p_conversation_id uuid,
  p_message_id uuid default null,
  p_reason_code text default null,
  p_reason_details text default null
)
returns public.conversation_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  conversation_row public.conversations;
  message_row public.conversation_messages;
  reported_user_id uuid;
  details text;
  report_row public.conversation_reports;
begin
  current_user_id := auth.uid();
  details := nullif(btrim(coalesce(p_reason_details, '')), '');

  if current_user_id is null then
    raise exception 'You must be signed in to submit a report.';
  end if;

  if p_conversation_id is null then
    raise exception 'Conversation is required.';
  end if;

  if not public.is_conversation_participant(p_conversation_id, current_user_id) then
    raise exception 'You do not have access to this conversation.';
  end if;

  select *
  into conversation_row
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if p_reason_code is null
    or not (
      p_reason_code = any (
        array[
          'spam'::text,
          'harassment'::text,
          'scam_or_suspicious'::text,
          'inappropriate_content'::text,
          'unsolicited_images'::text,
          'off_platform_payment'::text,
          'other'::text
        ]
      )
    )
  then
    raise exception 'Please choose a valid report reason.';
  end if;

  if p_reason_code = 'other' and (details is null or char_length(details) < 10) then
    raise exception 'Please add at least 10 characters of detail when choosing Other.';
  end if;

  if details is not null and char_length(details) > 1000 then
    raise exception 'Additional details must be 1000 characters or less.';
  end if;

  if p_message_id is not null then
    select *
    into message_row
    from public.conversation_messages
    where id = p_message_id
      and conversation_id = p_conversation_id;

    if not found then
      raise exception 'Message not found in this conversation.';
    end if;

    if message_row.sender_user_id = current_user_id then
      raise exception 'You cannot report your own message.';
    end if;

    reported_user_id := message_row.sender_user_id;
  else
    if current_user_id = conversation_row.buyer_user_id then
      reported_user_id := conversation_row.creator_user_id;
    elsif current_user_id = conversation_row.creator_user_id then
      reported_user_id := conversation_row.buyer_user_id;
    else
      raise exception 'Could not determine the reported user.';
    end if;
  end if;

  if reported_user_id is null then
    raise exception 'Reported user could not be determined.';
  end if;

  if reported_user_id = current_user_id then
    raise exception 'You cannot report yourself.';
  end if;

  insert into public.conversation_reports (
    conversation_id,
    message_id,
    reporter_user_id,
    reported_user_id,
    reason_code,
    reason_details,
    status
  )
  values (
    p_conversation_id,
    p_message_id,
    current_user_id,
    reported_user_id,
    p_reason_code,
    details,
    'submitted'
  )
  returning * into report_row;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    p_conversation_id,
    current_user_id,
    'conversation_reported',
    jsonb_build_object(
      'report_id', report_row.id,
      'message_id', p_message_id,
      'reported_user_id', reported_user_id,
      'reason_code', p_reason_code
    )
  );

  return report_row;
exception
  when unique_violation then
    raise exception 'You have already submitted a report for this item.';
end;
$$;

grant execute on function public.submit_conversation_report(
  uuid,
  uuid,
  text,
  text
)
to authenticated;