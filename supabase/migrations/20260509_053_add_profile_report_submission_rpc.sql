-- Adds user-facing profile report submission.
-- The frontend supplies only the profile user id, reason, and details.
-- reported_user_id is derived from the target profile.

create or replace function public.submit_profile_moderation_report(
  p_profile_user_id uuid,
  p_reason_code text,
  p_reason_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reporter_user_id uuid := auth.uid();
  v_reported_user_id uuid;
  v_report_id uuid;
  v_reason_details text := nullif(trim(coalesce(p_reason_details, '')), '');
begin
  if v_reporter_user_id is null then
    raise exception 'You must be signed in to report a profile.'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_reason_code, '')), '') is null then
    raise exception 'A report reason is required.'
      using errcode = '23514';
  end if;

  if v_reason_details is not null and length(v_reason_details) > 2000 then
    raise exception 'Report details must be 2000 characters or fewer.'
      using errcode = '23514';
  end if;

  select p.user_id
  into v_reported_user_id
  from public.profiles p
  where p.user_id = p_profile_user_id;

  if not found then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  if v_reported_user_id = v_reporter_user_id then
    raise exception 'You cannot report your own profile.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.moderation_reports mr
    where mr.target_type = 'profile'
      and mr.profile_user_id = p_profile_user_id
      and mr.reporter_user_id = v_reporter_user_id
  ) then
    raise exception 'You have already reported this profile.'
      using errcode = '23505';
  end if;

  insert into public.moderation_reports (
    target_type,
    profile_user_id,
    reporter_user_id,
    reported_user_id,
    reason_code,
    reason_details,
    status
  )
  values (
    'profile',
    p_profile_user_id,
    v_reporter_user_id,
    v_reported_user_id,
    p_reason_code,
    v_reason_details,
    'submitted'
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.submit_profile_moderation_report(uuid, text, text)
  from public;

grant execute on function public.submit_profile_moderation_report(uuid, text, text)
  to authenticated;