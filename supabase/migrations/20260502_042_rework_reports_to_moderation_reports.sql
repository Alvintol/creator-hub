-- Adds an admin update history log for moderation reports.
-- The moderation_reports table keeps the latest/current state.
-- moderation_report_updates stores every admin submission with time, user, status changes, and notes.

create table if not exists public.moderation_report_updates (
  id uuid not null default gen_random_uuid(),

  report_id uuid not null,
  admin_user_id uuid not null,

  previous_status text not null,
  new_status text not null,

  previous_resolution_code text null,
  new_resolution_code text null,

  reporter_status_message text null,
  admin_notes text null,

  created_at timestamp with time zone not null default now(),

  constraint moderation_report_updates_pkey primary key (id),

  constraint moderation_report_updates_report_id_fkey
    foreign key (report_id)
    references public.moderation_reports (id)
    on delete cascade,

  constraint moderation_report_updates_admin_user_id_fkey
    foreign key (admin_user_id)
    references auth.users (id),

  constraint moderation_report_updates_previous_status_check
    check (
      previous_status = any (
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

  constraint moderation_report_updates_new_status_check
    check (
      new_status = any (
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

  constraint moderation_report_updates_previous_resolution_code_check
    check (
      previous_resolution_code is null
      or previous_resolution_code = any (
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

  constraint moderation_report_updates_new_resolution_code_check
    check (
      new_resolution_code is null
      or new_resolution_code = any (
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

  constraint moderation_report_updates_reporter_status_message_check
    check (
      reporter_status_message is null
      or char_length(btrim(reporter_status_message)) <= 1000
    ),

  constraint moderation_report_updates_admin_notes_check
    check (
      admin_notes is null
      or char_length(btrim(admin_notes)) <= 2000
    )
);

create index if not exists moderation_report_updates_report_created_at_idx
on public.moderation_report_updates using btree (
  report_id,
  created_at desc
);

create index if not exists moderation_report_updates_admin_user_created_at_idx
on public.moderation_report_updates using btree (
  admin_user_id,
  created_at desc
);

alter table public.moderation_report_updates enable row level security;

grant select on public.moderation_report_updates to authenticated;

create policy "moderation report updates admin read"
on public.moderation_report_updates
for select
to authenticated
using (
  public.is_admin_user(auth.uid())
);


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
  updated_report_row public.moderation_reports;

  reporter_message text;
  next_resolution_code text;
  next_admin_notes text;
  final_resolution_code text;
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

  final_resolution_code :=
    case
      when p_resolution_code is null then report_row.resolution_code
      else next_resolution_code
    end;

  update public.moderation_reports
  set
    status = p_status,

    -- Latest reporter-visible message. Blank submissions preserve the previous value.
    reporter_status_message =
      case
        when reporter_message is null then report_row.reporter_status_message
        else reporter_message
      end,

    reporter_status_updated_at = now(),
    reporter_status_updated_by_user_id = current_user_id,

    resolution_code = final_resolution_code,

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

    -- Latest internal note. Blank submissions preserve the previous value.
    admin_notes =
      case
        when next_admin_notes is null then report_row.admin_notes
        else next_admin_notes
      end
  where id = p_report_id
  returning * into updated_report_row;

  insert into public.moderation_report_updates (
    report_id,
    admin_user_id,
    previous_status,
    new_status,
    previous_resolution_code,
    new_resolution_code,
    reporter_status_message,
    admin_notes
  )
  values (
    p_report_id,
    current_user_id,
    report_row.status,
    p_status,
    report_row.resolution_code,
    final_resolution_code,
    reporter_message,
    next_admin_notes
  );

  return updated_report_row;
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