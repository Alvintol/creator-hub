-- Reworks reporting from conversation-specific reports into generic moderation reports.
-- Supports current conversation/message reports and future listing/profile reports.

drop function if exists public.submit_conversation_report(uuid, uuid, text, text);

drop function if exists public.update_conversation_report_status(
  uuid,
  text,
  text,
  text,
  text
);

create unique index if not exists conversation_messages_id_conversation_id_uidx
on public.conversation_messages (id, conversation_id);

create table public.moderation_reports (
  id uuid not null default gen_random_uuid(),

  target_type text not null,

  conversation_id uuid null,
  message_id uuid null,
  listing_id uuid null,
  profile_user_id uuid null,

  reporter_user_id uuid not null,
  reported_user_id uuid not null,

  reason_code text not null,
  reason_details text null,

  status text not null default 'submitted',

  reporter_status_message text null,
  reporter_status_updated_at timestamp with time zone null,
  reporter_status_updated_by_user_id uuid null,

  resolution_code text null,
  resolved_at timestamp with time zone null,

  reviewed_at timestamp with time zone null,
  reviewed_by_user_id uuid null,
  admin_notes text null,

  created_at timestamp with time zone not null default now(),

  constraint moderation_reports_pkey primary key (id),

  constraint moderation_reports_conversation_id_fkey
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,

  constraint moderation_reports_message_conversation_fkey
    foreign key (message_id, conversation_id)
    references public.conversation_messages (id, conversation_id)
    on delete cascade,

  constraint moderation_reports_listing_id_fkey
    foreign key (listing_id)
    references public.listings (id),

  constraint moderation_reports_profile_user_id_fkey
    foreign key (profile_user_id)
    references auth.users (id),

  constraint moderation_reports_reporter_user_id_fkey
    foreign key (reporter_user_id)
    references auth.users (id),

  constraint moderation_reports_reported_user_id_fkey
    foreign key (reported_user_id)
    references auth.users (id),

  constraint moderation_reports_reporter_status_updated_by_user_id_fkey
    foreign key (reporter_status_updated_by_user_id)
    references auth.users (id),

  constraint moderation_reports_reviewed_by_user_id_fkey
    foreign key (reviewed_by_user_id)
    references auth.users (id),

  constraint moderation_reports_target_type_check
    check (
      target_type = any (
        array[
          'conversation'::text,
          'conversation_message'::text,
          'listing'::text,
          'profile'::text
        ]
      )
    ),

  constraint moderation_reports_target_context_check
    check (
      (
        target_type = 'conversation'
        and conversation_id is not null
        and message_id is null
        and listing_id is null
        and profile_user_id is null
      )
      or
      (
        target_type = 'conversation_message'
        and conversation_id is not null
        and message_id is not null
        and listing_id is null
        and profile_user_id is null
      )
      or
      (
        target_type = 'listing'
        and conversation_id is null
        and message_id is null
        and listing_id is not null
        and profile_user_id is null
      )
      or
      (
        target_type = 'profile'
        and conversation_id is null
        and message_id is null
        and listing_id is null
        and profile_user_id is not null
      )
    ),

  constraint moderation_reports_reporter_reported_check
    check (reporter_user_id <> reported_user_id),

  constraint moderation_reports_status_check
    check (
      status = any (
        array[
          'submitted'::text,
          'reviewing'::text,
          'needs_more_info'::text,
          'action_taken'::text,
          'resolved'::text,
          'dismissed'::text
        ]
      )
    ),

  constraint moderation_reports_reason_code_check
    check (
      reason_code = any (
        array[
          'spam'::text,
          'harassment'::text,
          'scam_or_suspicious'::text,
          'inappropriate_content'::text,
          'unsolicited_images'::text,
          'off_platform_payment'::text,
          'misleading_listing'::text,
          'stolen_or_copied_work'::text,
          'impersonation'::text,
          'policy_violation'::text,
          'other'::text
        ]
      )
    ),

  constraint moderation_reports_reason_details_check
    check (
      reason_details is null
      or char_length(btrim(reason_details)) <= 1000
    ),

  constraint moderation_reports_reporter_status_message_check
    check (
      reporter_status_message is null
      or char_length(btrim(reporter_status_message)) <= 1000
    ),

  constraint moderation_reports_resolution_code_check
    check (
      resolution_code is null
      or resolution_code = any (
        array[
          'warning_issued'::text,
          'content_removed'::text,
          'conversation_locked'::text,
          'account_restricted'::text,
          'no_violation_found'::text,
          'insufficient_information'::text,
          'duplicate_report'::text,
          'other'::text
        ]
      )
    ),

  constraint moderation_reports_admin_notes_check
    check (
      admin_notes is null
      or char_length(btrim(admin_notes)) <= 2000
    )
);

-- Backfill existing conversation_reports rows into moderation_reports.
-- Safe while local/dev reports exist; keeps old report IDs.
insert into public.moderation_reports (
  id,
  target_type,
  conversation_id,
  message_id,
  reporter_user_id,
  reported_user_id,
  reason_code,
  reason_details,
  status,
  reviewed_at,
  reviewed_by_user_id,
  admin_notes,
  created_at
)
select
  legacy_reports.id,
  case
    when legacy_reports.message_id is not null then 'conversation_message'
    else 'conversation'
  end,
  legacy_reports.conversation_id,
  legacy_reports.message_id,
  legacy_reports.reporter_user_id,
  legacy_reports.derived_reported_user_id,
  legacy_reports.reason_code,
  legacy_reports.reason_details,
  legacy_reports.status,
  legacy_reports.reviewed_at,
  legacy_reports.reviewed_by_user_id,
  legacy_reports.admin_notes,
  legacy_reports.created_at
from (
  select
    conversation_reports.*,
    coalesce(
      conversation_reports.reported_user_id,
      conversation_messages.sender_user_id,
      case
        when conversation_reports.reporter_user_id = conversations.buyer_user_id
          then conversations.creator_user_id
        when conversation_reports.reporter_user_id = conversations.creator_user_id
          then conversations.buyer_user_id
        else null
      end
    ) as derived_reported_user_id,
    row_number() over (
      partition by
        conversation_reports.reporter_user_id,
        case
          when conversation_reports.message_id is not null then 'conversation_message'
          else 'conversation'
        end,
        conversation_reports.conversation_id,
        conversation_reports.message_id
      order by conversation_reports.created_at asc, conversation_reports.id asc
    ) as duplicate_rank
  from public.conversation_reports
  left join public.conversation_messages
    on conversation_messages.id = conversation_reports.message_id
  left join public.conversations
    on conversations.id = conversation_reports.conversation_id
) as legacy_reports
where legacy_reports.derived_reported_user_id is not null
  and legacy_reports.reporter_user_id <> legacy_reports.derived_reported_user_id
  and legacy_reports.duplicate_rank = 1
on conflict (id) do nothing;

create unique index if not exists moderation_reports_unique_conversation_reporter_idx
on public.moderation_reports (
  conversation_id,
  reporter_user_id
)
where target_type = 'conversation';

create unique index if not exists moderation_reports_unique_message_reporter_idx
on public.moderation_reports (
  message_id,
  reporter_user_id
)
where target_type = 'conversation_message';

create unique index if not exists moderation_reports_unique_listing_reporter_idx
on public.moderation_reports (
  listing_id,
  reporter_user_id
)
where target_type = 'listing';

create unique index if not exists moderation_reports_unique_profile_reporter_idx
on public.moderation_reports (
  profile_user_id,
  reporter_user_id
)
where target_type = 'profile';

create index if not exists moderation_reports_target_type_status_created_at_idx
on public.moderation_reports using btree (
  target_type,
  status,
  created_at desc
);

create index if not exists moderation_reports_reported_user_status_created_at_idx
on public.moderation_reports using btree (
  reported_user_id,
  status,
  created_at desc
);

create index if not exists moderation_reports_reporter_status_created_at_idx
on public.moderation_reports using btree (
  reporter_user_id,
  status,
  created_at desc
);

create index if not exists moderation_reports_reported_user_reason_created_at_idx
on public.moderation_reports using btree (
  reported_user_id,
  reason_code,
  created_at desc
);

create index if not exists moderation_reports_reporter_reason_created_at_idx
on public.moderation_reports using btree (
  reporter_user_id,
  reason_code,
  created_at desc
);

create index if not exists moderation_reports_conversation_id_idx
on public.moderation_reports using btree (conversation_id);

create index if not exists moderation_reports_message_id_idx
on public.moderation_reports using btree (message_id);

create index if not exists moderation_reports_listing_id_idx
on public.moderation_reports using btree (listing_id);

create index if not exists moderation_reports_profile_user_id_idx
on public.moderation_reports using btree (profile_user_id);

alter table public.moderation_reports enable row level security;

grant select on public.moderation_reports to authenticated;

create policy "moderation reports reporter read own"
on public.moderation_reports
for select
to authenticated
using (
  reporter_user_id = auth.uid()
);

create policy "moderation reports admin read"
on public.moderation_reports
for select
to authenticated
using (
  public.is_admin_user(auth.uid())
);

create or replace function public.submit_moderation_report(
  p_target_type text,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_listing_id uuid default null,
  p_profile_user_id uuid default null,
  p_reason_code text default null,
  p_reason_details text default null
)
returns public.moderation_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  conversation_row public.conversations;
  message_row public.conversation_messages;
  listing_owner_user_id uuid;
  profile_exists boolean;
  derived_reported_user_id uuid;
  details text;
  report_row public.moderation_reports;
begin
  current_user_id := auth.uid();
  details := nullif(btrim(coalesce(p_reason_details, '')), '');

  if current_user_id is null then
    raise exception 'You must be signed in to submit a report.';
  end if;

  if p_target_type is null
    or not (
      p_target_type = any (
        array[
          'conversation'::text,
          'conversation_message'::text,
          'listing'::text,
          'profile'::text
        ]
      )
    )
  then
    raise exception 'Please choose a valid report target.';
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
          'misleading_listing'::text,
          'stolen_or_copied_work'::text,
          'impersonation'::text,
          'policy_violation'::text,
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

  if p_target_type = 'conversation' then
    if p_conversation_id is null
      or p_message_id is not null
      or p_listing_id is not null
      or p_profile_user_id is not null
    then
      raise exception 'Conversation reports require only a conversation target.';
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

    if current_user_id = conversation_row.buyer_user_id then
      derived_reported_user_id := conversation_row.creator_user_id;
    elsif current_user_id = conversation_row.creator_user_id then
      derived_reported_user_id := conversation_row.buyer_user_id;
    else
      raise exception 'Could not determine the reported user.';
    end if;
  elsif p_target_type = 'conversation_message' then
    if p_conversation_id is null
      or p_message_id is null
      or p_listing_id is not null
      or p_profile_user_id is not null
    then
      raise exception 'Message reports require a conversation and message target.';
    end if;

    if not public.is_conversation_participant(p_conversation_id, current_user_id) then
      raise exception 'You do not have access to this conversation.';
    end if;

    select *
    into message_row
    from public.conversation_messages
    where id = p_message_id
      and conversation_id = p_conversation_id;

    if not found then
      raise exception 'Message not found in this conversation.';
    end if;

    if message_row.message_type = 'system' then
      raise exception 'System messages cannot be reported.';
    end if;

    derived_reported_user_id := message_row.sender_user_id;
  elsif p_target_type = 'listing' then
    if p_listing_id is null
      or p_conversation_id is not null
      or p_message_id is not null
      or p_profile_user_id is not null
    then
      raise exception 'Listing reports require only a listing target.';
    end if;

    select listings.user_id
    into listing_owner_user_id
    from public.listings
    where listings.id = p_listing_id;

    if not found then
      raise exception 'Listing not found.';
    end if;

    derived_reported_user_id := listing_owner_user_id;
  elsif p_target_type = 'profile' then
    if p_profile_user_id is null
      or p_conversation_id is not null
      or p_message_id is not null
      or p_listing_id is not null
    then
      raise exception 'Profile reports require only a profile target.';
    end if;

    select exists (
      select 1
      from public.profiles
      where profiles.user_id = p_profile_user_id
    )
    into profile_exists;

    if not profile_exists then
      raise exception 'Profile not found.';
    end if;

    derived_reported_user_id := p_profile_user_id;
  end if;

  if derived_reported_user_id is null then
    raise exception 'Reported user could not be determined.';
  end if;

  if derived_reported_user_id = current_user_id then
    raise exception 'You cannot report yourself.';
  end if;

  insert into public.moderation_reports (
    target_type,
    conversation_id,
    message_id,
    listing_id,
    profile_user_id,
    reporter_user_id,
    reported_user_id,
    reason_code,
    reason_details,
    status
  )
  values (
    p_target_type,
    p_conversation_id,
    p_message_id,
    p_listing_id,
    p_profile_user_id,
    current_user_id,
    derived_reported_user_id,
    p_reason_code,
    details,
    'submitted'
  )
  returning * into report_row;

  if p_conversation_id is not null then
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
        'target_type', p_target_type,
        'message_id', p_message_id,
        'reported_user_id', derived_reported_user_id,
        'reason_code', p_reason_code
      )
    );
  end if;

  return report_row;
exception
  when unique_violation then
    raise exception 'You have already submitted a report for this item.';
end;
$$;

grant execute on function public.submit_moderation_report(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text
)
to authenticated;

create or replace function public.update_moderation_report_status(
  p_report_id uuid,
  p_status text,
  p_reporter_status_message text default null,
  p_resolution_code text default null,
  p_admin_notes text default null
)
returns public.moderation_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  report_row public.moderation_reports;
  reporter_message text;
  next_resolution_code text;
  next_admin_notes text;
begin
  current_user_id := auth.uid();
  reporter_message := nullif(btrim(coalesce(p_reporter_status_message, '')), '');
  next_resolution_code := nullif(btrim(coalesce(p_resolution_code, '')), '');
  next_admin_notes := nullif(btrim(coalesce(p_admin_notes, '')), '');

  if current_user_id is null then
    raise exception 'You must be signed in to update a report.';
  end if;

  if not public.is_admin_user(current_user_id) then
    raise exception 'Only admins can update report status.';
  end if;

  if p_status is null
    or not (
      p_status = any (
        array[
          'submitted'::text,
          'reviewing'::text,
          'needs_more_info'::text,
          'action_taken'::text,
          'resolved'::text,
          'dismissed'::text
        ]
      )
    )
  then
    raise exception 'Please choose a valid report status.';
  end if;

  if reporter_message is not null and char_length(reporter_message) > 1000 then
    raise exception 'Reporter status message must be 1000 characters or less.';
  end if;

  if next_admin_notes is not null and char_length(next_admin_notes) > 2000 then
    raise exception 'Admin notes must be 2000 characters or less.';
  end if;

  if next_resolution_code is not null
    and not (
      next_resolution_code = any (
        array[
          'warning_issued'::text,
          'content_removed'::text,
          'conversation_locked'::text,
          'account_restricted'::text,
          'no_violation_found'::text,
          'insufficient_information'::text,
          'duplicate_report'::text,
          'other'::text
        ]
      )
    )
  then
    raise exception 'Please choose a valid resolution code.';
  end if;

  select *
  into report_row
  from public.moderation_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found.';
  end if;

  update public.moderation_reports
  set
    status = p_status,
    reporter_status_message =
      case
        when p_reporter_status_message is null then report_row.reporter_status_message
        else reporter_message
      end,
    reporter_status_updated_at = now(),
    reporter_status_updated_by_user_id = current_user_id,
    resolution_code =
      case
        when p_resolution_code is null then report_row.resolution_code
        else next_resolution_code
      end,
    resolved_at =
      case
        when p_status = any (
          array[
            'action_taken'::text,
            'resolved'::text,
            'dismissed'::text
          ]
        )
          then coalesce(report_row.resolved_at, now())
        else null
      end,
    reviewed_at = now(),
    reviewed_by_user_id = current_user_id,
    admin_notes =
      case
        when p_admin_notes is null then report_row.admin_notes
        else next_admin_notes
      end
  where id = p_report_id
  returning * into report_row;

  return report_row;
end;
$$;

grant execute on function public.update_moderation_report_status(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;

drop table if exists public.conversation_reports;