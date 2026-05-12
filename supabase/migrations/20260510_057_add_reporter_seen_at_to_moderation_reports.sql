-- Tracks whether the reporter has seen the latest reporter-visible moderation update.

alter table public.moderation_reports
  add column if not exists reporter_seen_at timestamptz;

drop function if exists public.get_my_moderation_reports();

create or replace function public.get_my_moderation_reports()
returns table (
  id uuid,
  target_type text,
  target_label text,
  reason_code text,
  reason_details text,
  status text,
  reporter_status_message text,
  reporter_status_updated_at timestamptz,
  reporter_seen_at timestamptz,
  has_unread_update boolean,
  resolution_code text,
  resolved_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    mr.id,
    mr.target_type::text,
    coalesce(
      c.subject,
      l.title,
      nullif(p.handle, ''),
      p.display_name,
      mr.profile_user_id::text,
      mr.listing_id::text,
      mr.conversation_id::text,
      mr.target_type::text
    ) as target_label,
    mr.reason_code::text,
    mr.reason_details,
    mr.status::text,
    mr.reporter_status_message,
    mr.reporter_status_updated_at,
    mr.reporter_seen_at,
    (
      mr.reporter_status_updated_at is not null
      and (
        mr.reporter_seen_at is null
        or mr.reporter_status_updated_at > mr.reporter_seen_at
      )
    ) as has_unread_update,
    mr.resolution_code::text,
    mr.resolved_at,
    mr.created_at
  from public.moderation_reports mr
  left join public.conversations c
    on c.id = mr.conversation_id
  left join public.listings l
    on l.id = mr.listing_id
  left join public.profiles p
    on p.user_id = mr.profile_user_id
  where mr.reporter_user_id = auth.uid()
  order by mr.created_at desc;
$$;

create or replace function public.mark_my_moderation_reports_seen()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to mark reports as seen.'
      using errcode = '42501';
  end if;

  update public.moderation_reports mr
  set reporter_seen_at = now()
  where mr.reporter_user_id = v_user_id
    and mr.reporter_status_updated_at is not null
    and (
      mr.reporter_seen_at is null
      or mr.reporter_status_updated_at > mr.reporter_seen_at
    );

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$$;

revoke all on function public.get_my_moderation_reports() from public;
revoke all on function public.mark_my_moderation_reports_seen() from public;

grant execute on function public.get_my_moderation_reports() to authenticated;
grant execute on function public.mark_my_moderation_reports_seen() to authenticated;