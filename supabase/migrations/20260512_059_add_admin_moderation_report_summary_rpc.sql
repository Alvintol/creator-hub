-- Adds an admin-only moderation summary RPC for /admin/reports.
-- Counts are global, not limited to the current paginated report page.

create or replace function public.get_admin_moderation_report_summary()
returns table (
  submitted_count bigint,
  active_count bigint,
  resolved_count bigint,
  unread_reporter_update_count bigint,
  profile_under_review_count bigint,
  hidden_listing_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_user_id uuid := auth.uid();
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to view moderation report summaries.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can view moderation report summaries.'
      using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*)
      from public.moderation_reports mr
      where mr.status = 'submitted'
    ) as submitted_count,
    (
      select count(*)
      from public.moderation_reports mr
      where mr.resolved_at is null
    ) as active_count,
    (
      select count(*)
      from public.moderation_reports mr
      where mr.resolved_at is not null
    ) as resolved_count,
    (
      select count(*)
      from public.moderation_reports mr
      where mr.reporter_status_updated_at is not null
        and (
          mr.reporter_seen_at is null
          or mr.reporter_status_updated_at > mr.reporter_seen_at
        )
    ) as unread_reporter_update_count,
    (
      select count(*)
      from public.profile_moderation_states pms
      where pms.is_under_review is true
    ) as profile_under_review_count,
    (
      select count(*)
      from public.listings l
      where l.status = 'published'
        and l.is_active is false
    ) as hidden_listing_count;
end;
$$;

revoke all on function public.get_admin_moderation_report_summary() from public;

grant execute on function public.get_admin_moderation_report_summary()
  to authenticated;