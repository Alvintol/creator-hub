-- Allows buyers, creators, and admins to read listing request rows directly.
-- Request detail pages load from listing_requests, not just conversations.

drop policy if exists "request participants can read listing requests"
on public.listing_requests;

create policy "request participants can read listing requests"
on public.listing_requests
for select
to authenticated
using (
  buyer_user_id = auth.uid()
  or creator_user_id = auth.uid()
  or exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  )
);

-- Admin dashboards currently load request review data through request-linked
-- conversations, so admins also need to read those conversation rows.

drop policy if exists "admins can read request conversations"
on public.conversations;

create policy "admins can read request conversations"
on public.conversations
for select
to authenticated
using (
  conversation_type = 'listing_request'
  and exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  )
);

drop policy if exists "admins can read request conversation participants"
on public.conversation_participants;

create policy "admins can read request conversation participants"
on public.conversation_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = conversation_participants.conversation_id
      and conversations.conversation_type = 'listing_request'
      and exists (
        select 1
        from public.admin_roles
        where admin_roles.profile_user_id = auth.uid()
      )
  )
);