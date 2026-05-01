-- Adds reporter-visible report status updates.
-- Admin notes remain internal, while reporter_status_message is safe to show to the reporting user.

alter table public.conversation_reports
drop constraint if exists conversation_reports_status_check;

alter table public.conversation_reports
add constraint conversation_reports_status_check
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
);

alter table public.conversation_reports
add column if not exists reporter_status_message text null;

alter table public.conversation_reports
add column if not exists reporter_status_updated_at timestamp with time zone null;

alter table public.conversation_reports
add column if not exists reporter_status_updated_by_user_id uuid null;

alter table public.conversation_reports
add column if not exists resolution_code text null;

alter table public.conversation_reports
add column if not exists resolved_at timestamp with time zone null;

alter table public.conversation_reports
drop constraint if exists conversation_reports_reporter_status_updated_by_user_id_fkey;

alter table public.conversation_reports
add constraint conversation_reports_reporter_status_updated_by_user_id_fkey
foreign key (reporter_status_updated_by_user_id)
references auth.users (id);

alter table public.conversation_reports
drop constraint if exists conversation_reports_reporter_status_message_check;

alter table public.conversation_reports
add constraint conversation_reports_reporter_status_message_check
check (
  reporter_status_message is null
  or char_length(btrim(reporter_status_message)) <= 1000
);

alter table public.conversation_reports
drop constraint if exists conversation_reports_resolution_code_check;

alter table public.conversation_reports
add constraint conversation_reports_resolution_code_check
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
);

create index if not exists conversation_reports_reporter_status_idx
on public.conversation_reports using btree (
  reporter_user_id,
  status,
  created_at desc
);

create or replace function public.update_conversation_report_status(
  p_report_id uuid,
  p_status text,
  p_reporter_status_message text default null,
  p_resolution_code text default null,
  p_admin_notes text default null
)
returns public.conversation_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  report_row public.conversation_reports;
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
  from public.conversation_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found.';
  end if;

  update public.conversation_reports
  set
    status = p_status,

    -- Passing null preserves the existing reporter-facing message.
    -- Passing an empty string clears it.
    reporter_status_message =
      case
        when p_reporter_status_message is null then report_row.reporter_status_message
        else reporter_message
      end,

    reporter_status_updated_at = now(),
    reporter_status_updated_by_user_id = current_user_id,

    -- Passing null preserves the existing resolution code.
    -- Passing an empty string clears it.
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

    -- Passing null preserves internal admin notes.
    -- Passing an empty string clears them.
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

grant execute on function public.update_conversation_report_status(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;