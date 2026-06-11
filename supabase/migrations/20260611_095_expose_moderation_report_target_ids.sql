drop function if exists public.get_my_moderation_reports();

create function public.get_my_moderation_reports()
returns table (
  id uuid,
  target_type text,
  conversation_id uuid,
  message_id uuid,
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
    mr.conversation_id,
    mr.message_id,

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
        or mr.reporter_status_updated_at >
          mr.reporter_seen_at
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

revoke all
on function public.get_my_moderation_reports()
from public;

grant execute
on function public.get_my_moderation_reports()
to authenticated;