-- Adds user-facing listing report submission.
-- The frontend supplies only the listing, reason, and details.
-- reported_user_id is derived from the listing owner in this RPC.

create or replace function public.submit_listing_moderation_report(
  p_listing_id uuid,
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
    raise exception 'You must be signed in to report a listing.'
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

  select l.user_id
  into v_reported_user_id
  from public.listings l
  where l.id = p_listing_id
    and l.status = 'published'
    and l.is_active is true;

  if not found then
    raise exception 'Listing not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_reported_user_id = v_reporter_user_id then
    raise exception 'You cannot report your own listing.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.moderation_reports mr
    where mr.target_type = 'listing'
      and mr.listing_id = p_listing_id
      and mr.reporter_user_id = v_reporter_user_id
  ) then
    raise exception 'You have already reported this listing.'
      using errcode = '23505';
  end if;

  insert into public.moderation_reports (
    target_type,
    listing_id,
    reporter_user_id,
    reported_user_id,
    reason_code,
    reason_details,
    status
  )
  values (
    'listing',
    p_listing_id,
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

revoke all on function public.submit_listing_moderation_report(uuid, text, text)
  from public;

grant execute on function public.submit_listing_moderation_report(uuid, text, text)
  to authenticated;