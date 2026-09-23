-- Sprint 5 (launch-scope.md section 6.5): "Blocking new requests, not hiding
-- listings." A hidden listing loses its search position, link history and
-- reviews -- blocking at the point of a new request is the narrower action
-- that achieves the same thing. The enforcement point is the RLS policy
-- itself, not a UI courtesy on top of it.

-- A boolean, not the balance itself -- safe for the buyer-facing UI to call
-- directly (checklist item: "without exposing the creator's financial
-- detail to buyers") while still being the same check the RLS policy uses,
-- so the two can never disagree about whether a request would be blocked.
create or replace function public.creator_has_outstanding_recovery_balance(
  p_creator_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select outstanding_cents > 0
      from public.creator_recovery_balances
      where creator_user_id = p_creator_user_id
    ),
    false
  );
$$;

revoke execute on function public.creator_has_outstanding_recovery_balance(uuid)
  from public;

grant execute on function public.creator_has_outstanding_recovery_balance(uuid)
  to anon, authenticated;

-- Current definition per 20260518_061_expand_listing_request_submission_fields.sql,
-- with the outstanding-balance check added.
drop policy if exists "listing requests buyer insert" on public.listing_requests;

create policy "listing requests buyer insert"
on public.listing_requests
for insert
to authenticated
with check (
  auth.uid() = buyer_user_id
  and buyer_user_id <> creator_user_id
  and not public.creator_has_outstanding_recovery_balance(creator_user_id)
  and exists (
    select 1
    from public.listings
    where listings.id = listing_requests.listing_id
      and listings.user_id = listing_requests.creator_user_id
      and listings.status = 'published'::text
      and listings.is_active = true
      and listings.fulfilment_mode = 'request'::text
      and listings.admin_hidden_at is null
  )
);

notify pgrst, 'reload schema';
