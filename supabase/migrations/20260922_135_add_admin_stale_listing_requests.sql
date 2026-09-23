-- Sprint 6 checklist: "Staleness query surfaced in admin: requests not
-- advanced in 14+ days with a pending action on one side." REQ-003's db
-- signal in docs/support/requests/request-lifecycle.md.
--
-- "Not advanced" is approximated as: no listing_requests row update and no
-- conversation message in the last 14 days, on a request that is still
-- active (status = 'accepted') and has not already been closed. This does
-- not attempt to replicate requestWorkspace.ts's full "whose turn is it"
-- logic in SQL -- that lives in the frontend and stays there; this is a
-- coarser, cheaper admin signal that a request needs a human look, not a
-- precise re-derivation of workflow state.
create or replace function public.admin_list_stale_listing_requests(
  p_stale_after_days integer default 14
)
returns table (
  listing_request_id uuid,
  buyer_user_id uuid,
  creator_user_id uuid,
  status text,
  last_activity_at timestamptz,
  days_since_activity numeric,
  has_open_notice boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with last_message as (
    select
      conversations.listing_request_id,
      max(conversation_messages.created_at) as last_message_at
    from public.conversation_messages
    join public.conversations
      on conversations.id = conversation_messages.conversation_id
    group by conversations.listing_request_id
  ),
  activity as (
    select
      listing_requests.id as listing_request_id,
      listing_requests.buyer_user_id,
      listing_requests.creator_user_id,
      listing_requests.status,
      greatest(
        listing_requests.updated_at,
        coalesce(last_message.last_message_at, listing_requests.updated_at)
      ) as last_activity_at
    from public.listing_requests
    left join last_message
      on last_message.listing_request_id = listing_requests.id
    where listing_requests.status = 'accepted'
      and not exists (
        select 1 from public.listing_request_closures
        where listing_request_closures.listing_request_id = listing_requests.id
      )
  )
  select
    activity.listing_request_id,
    activity.buyer_user_id,
    activity.creator_user_id,
    activity.status,
    activity.last_activity_at,
    round(extract(epoch from (now() - activity.last_activity_at)) / 86400, 1),
    exists (
      select 1
      from public.listing_request_notices
      where listing_request_notices.listing_request_id = activity.listing_request_id
        and listing_request_notices.answered_at is null
    )
  from activity
  where activity.last_activity_at < now() - make_interval(days => greatest(p_stale_after_days, 1))
  order by activity.last_activity_at asc;
$$;

revoke all on function public.admin_list_stale_listing_requests(integer)
from public, anon, authenticated;

-- Admin-only. The sql-language function above cannot raise on a failed
-- permission check, so the check is enforced in this plpgsql wrapper, which
-- is the one actually granted to authenticated and callable via RPC.
create or replace function public.admin_list_stale_listing_requests_checked(
  p_stale_after_days integer default 14
)
returns table (
  listing_request_id uuid,
  buyer_user_id uuid,
  creator_user_id uuid,
  status text,
  last_activity_at timestamptz,
  days_since_activity numeric,
  has_open_notice boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  return query select * from public.admin_list_stale_listing_requests(p_stale_after_days);
end;
$$;

revoke all on function public.admin_list_stale_listing_requests_checked(integer)
from public, anon, authenticated;

grant execute on function public.admin_list_stale_listing_requests_checked(integer)
to authenticated;

notify pgrst, 'reload schema';
