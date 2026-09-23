-- Sprint 6 (launch-scope.md section 7): administrative closure. Admin-only,
-- callable once a final notice has expired with no substantive reply (or an
-- approved early-review flag stands in for that wait), on request from the
-- waiting party -- never unilateral. Records the closure reason, preserves
-- full history, and is explicitly NOT a finding that the work was
-- satisfactory (Refund Policy §6).
--
-- The two branches do different things, per section 7's table:
--   buyer_unresponsive:   the creator was waiting. Unfinished work cancels.
--                         Unearned prepaid amounts *remain refundable* --
--                         available through the ordinary admin refund route
--                         (POST /api/stripe/refunds), not auto-issued here,
--                         because there is no itemised earned-value
--                         statement (the creator is present and may dispute
--                         the amount) the way Sprint 4's cancellation flow
--                         has.
--   creator_unresponsive: the buyer was waiting. Unfinished work cancels
--                         AND every paid-but-unrefunded amount is flagged
--                         for refund -- "a creator who retains payment must
--                         evidence earned value," and an unresponsive
--                         creator has evidenced none, so the whole
--                         remaining paid amount on every non-terminal
--                         payment counts as unearned.
--
-- The flagged amounts are drained by POST
-- /api/stripe/refunds/drain-flagged-for-request (extended in this same
-- sprint to also read listing_request_closure_refund_items), which calls
-- Sprint 5's apply_refunded_listing_request_payment -- a Postgres RPC
-- cannot call Stripe, so nothing here issues a refund directly, matching
-- the cancellation-cascade drain pattern exactly.

create table if not exists public.listing_request_closures (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,

  branch text not null check (branch in ('buyer_unresponsive', 'creator_unresponsive')),

  admin_user_id uuid not null,
  requested_by_user_id uuid not null,

  reason text not null check (
    char_length(btrim(reason)) >= 10
    and char_length(btrim(reason)) <= 1000
  ),

  final_notice_id uuid null references public.listing_request_notices(id),
  early_review_flag_id uuid null references public.listing_request_early_review_flags(id),

  created_at timestamptz not null default now(),

  check (final_notice_id is not null or early_review_flag_id is not null)
);

create index if not exists
listing_request_closures_request_idx
on public.listing_request_closures(listing_request_id);

-- Only one closure per request, ever -- closure is terminal.
create unique index if not exists
listing_request_closures_one_per_request_idx
on public.listing_request_closures(listing_request_id);

alter table public.listing_request_closures enable row level security;

drop policy if exists "closure participants can read"
on public.listing_request_closures;

create policy "closure participants can read"
on public.listing_request_closures
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_requests
    where listing_requests.id = listing_request_closures.listing_request_id
      and (
        listing_requests.buyer_user_id = auth.uid()
        or listing_requests.creator_user_id = auth.uid()
      )
  )
);

drop policy if exists "admins can read closures"
on public.listing_request_closures;

create policy "admins can read closures"
on public.listing_request_closures
for select
to authenticated
using (public.is_admin_user(auth.uid()));

-- Same shape as listing_request_cancellation_proposal_items
-- (20260922_124): a payment flagged for the drain route to actually refund,
-- and the timestamp it was refunded at. Kept as its own table rather than
-- reusing the cancellation-proposal one -- an administrative closure is not
-- a cancellation proposal and has no proposal_id to hang off.
create table if not exists public.listing_request_closure_refund_items (
  id uuid primary key default gen_random_uuid(),

  closure_id uuid not null references public.listing_request_closures(id) on delete cascade,
  payment_id uuid not null references public.listing_request_payments(id),

  unearned_amount_cents integer not null check (unearned_amount_cents > 0),

  flagged_for_refund_at timestamptz not null default now(),
  refunded_at timestamptz null,

  unique (closure_id, payment_id)
);

create index if not exists
listing_request_closure_refund_items_unrefunded_idx
on public.listing_request_closure_refund_items(flagged_for_refund_at)
where refunded_at is null;

create index if not exists
listing_request_closure_refund_items_closure_idx
on public.listing_request_closure_refund_items(closure_id);

alter table public.listing_request_closure_refund_items enable row level security;

drop policy if exists "admins can read closure refund items"
on public.listing_request_closure_refund_items;

create policy "admins can read closure refund items"
on public.listing_request_closure_refund_items
for select
to authenticated
using (public.is_admin_user(auth.uid()));

-- No insert/update/delete policy for any client role on either table --
-- every write goes through admin_close_listing_request_for_non_response
-- (writes) or the drain route (service role, sets refunded_at).

-- Sprint 5's ledger records where a refund came from (initiated_via). Add a
-- distinct value for this cascade rather than overloading
-- 'cancellation_cascade', which specifically means a Sprint 4 accepted
-- cancellation statement -- these are a different event with a different
-- audit story (no itemised statement, non-response driven).
alter table public.listing_request_payment_refunds
drop constraint if exists listing_request_payment_refunds_initiated_via_check;

alter table public.listing_request_payment_refunds
add constraint listing_request_payment_refunds_initiated_via_check
check (
  initiated_via in (
    'admin', 'cancellation_cascade', 'system_auto_refund', 'webhook_external', 'closure_cascade'
  )
);

create or replace function public.admin_close_listing_request_for_non_response(
  p_request_id uuid,
  p_branch text,
  p_requested_by_user_id uuid,
  p_reason text,
  p_early_review_flag_id uuid default null
)
returns table (
  closure_id uuid,
  branch text,
  request_status text,
  flagged_payment_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_requests%rowtype;
  agreement_row public.listing_request_agreements%rowtype;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  close_time timestamptz := now();
  waiting_party_expected uuid;
  matched_final_notice_id uuid;
  early_review_flag_row public.listing_request_early_review_flags%rowtype;
  new_closure_id uuid;
  new_flagged_ids uuid[] := array[]::uuid[];
  payment_row record;
  already_refunded integer;
  unearned integer;
  conversation_id uuid;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if p_branch not in ('buyer_unresponsive', 'creator_unresponsive') then
    raise exception
      'Unknown closure branch: %.', p_branch
      using errcode = '22023';
  end if;

  if clean_reason is null
    or char_length(clean_reason) < 10
    or char_length(clean_reason) > 1000 then
    raise exception
      'The closure reason must be between 10 and 1000 characters.'
      using errcode = '22023';
  end if;

  select *
  into request_row
  from public.listing_requests
  where listing_requests.id = p_request_id
  for update;

  if not found then
    raise exception
      'Listing request not found.'
      using errcode = 'P0001';
  end if;

  if request_row.status <> 'accepted' then
    raise exception
      'Only an active request can be administratively closed.'
      using errcode = 'P0001';
  end if;

  -- The "waiting party" for each branch is the party who was NOT the one
  -- expected to act: on buyer_unresponsive, the creator was waiting; on
  -- creator_unresponsive, the buyer was waiting.
  waiting_party_expected := case
    when p_branch = 'buyer_unresponsive' then request_row.creator_user_id
    else request_row.buyer_user_id
  end;

  if p_requested_by_user_id <> waiting_party_expected then
    raise exception
      'The closure request must come from the waiting party for this branch.'
      using errcode = '22023';
  end if;

  if p_early_review_flag_id is not null then
    select *
    into early_review_flag_row
    from public.listing_request_early_review_flags
    where listing_request_early_review_flags.id = p_early_review_flag_id
      and listing_request_early_review_flags.listing_request_id = p_request_id
      and listing_request_early_review_flags.status = 'approved'
    for update;

    if not found then
      raise exception
        'No approved early review request was found for this request.'
        using errcode = 'P0001';
    end if;
  else
    select id
    into matched_final_notice_id
    from public.listing_request_notices
    where listing_request_notices.listing_request_id = p_request_id
      and listing_request_notices.notice_type = 'final'
      and listing_request_notices.sender_user_id = p_requested_by_user_id
      and listing_request_notices.answered_at is null
      and listing_request_notices.expires_at <= close_time
    order by listing_request_notices.sent_at desc
    limit 1;

    if matched_final_notice_id is null then
      raise exception
        'No expired, unanswered final notice was found for the waiting party on this request.'
        using errcode = 'P0001';
    end if;

    if public.listing_request_has_substantive_reply(
      p_request_id,
      case when p_branch = 'buyer_unresponsive' then request_row.buyer_user_id
           else request_row.creator_user_id end,
      (select sent_at from public.listing_request_notices where id = matched_final_notice_id)
    ) then
      raise exception
        'A substantive reply was received. This request cannot be administratively closed.'
        using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1 from public.listing_request_closures
    where listing_request_closures.listing_request_id = p_request_id
  ) then
    raise exception
      'This request has already been administratively closed.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.listing_request_id = p_request_id
    and listing_request_agreements.status = 'buyer_accepted'
  order by listing_request_agreements.version_number desc
  limit 1
  for update;

  insert into public.listing_request_closures (
    listing_request_id,
    branch,
    admin_user_id,
    requested_by_user_id,
    reason,
    final_notice_id,
    early_review_flag_id
  )
  values (
    p_request_id,
    p_branch,
    auth.uid(),
    p_requested_by_user_id,
    clean_reason,
    matched_final_notice_id,
    p_early_review_flag_id
  )
  returning id into new_closure_id;

  -- Cancel unfinished work. Same shape as Sprint 4's
  -- respond_listing_request_cancellation_proposal cascade -- unpaid
  -- schedule items and every other non-terminal workflow object cancel.
  if agreement_row.id is not null then
    update public.listing_request_agreements
    set status = 'cancelled', cancelled_at = close_time
    where id = agreement_row.id;

    update public.listing_request_payment_schedule_items
    set status = 'cancelled', updated_at = close_time
    where listing_request_payment_schedule_items.agreement_id = agreement_row.id
      and listing_request_payment_schedule_items.status in ('pending', 'payment_required');

    update public.listing_request_timeline_holds
    set ended_at = close_time
    where listing_request_timeline_holds.agreement_id = agreement_row.id
      and listing_request_timeline_holds.ended_at is null;
  end if;

  update public.listing_request_milestones
  set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
  where listing_request_milestones.listing_request_id = p_request_id
    and listing_request_milestones.status not in ('paid', 'cancelled');

  update public.listing_request_change_orders
  set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
  where listing_request_change_orders.listing_request_id = p_request_id
    and listing_request_change_orders.status in ('draft', 'sent');

  update public.listing_request_final_deliveries
  set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
  where listing_request_final_deliveries.listing_request_id = p_request_id
    and listing_request_final_deliveries.status in ('draft', 'submitted', 'revision_requested');

  update public.listing_request_payments
  set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
  where listing_request_payments.listing_request_id = p_request_id
    and listing_request_payments.status in ('requires_checkout', 'checkout_opened');

  -- creator_unresponsive only: flag every paid-but-unrefunded amount as
  -- unearned. No itemised statement exists, so the whole remaining base
  -- amount counts -- section 7's "a creator who retains payment must
  -- evidence earned value," and an unresponsive creator has evidenced none.
  if p_branch = 'creator_unresponsive' then
    for payment_row in
      select id, base_amount_cents
      from public.listing_request_payments
      where listing_request_payments.listing_request_id = p_request_id
        and listing_request_payments.status in ('paid', 'partially_refunded')
    loop
      select coalesce(sum(base_refund_cents), 0)
      into already_refunded
      from public.listing_request_payment_refunds
      where listing_request_payment_refunds.payment_id = payment_row.id;

      unearned := payment_row.base_amount_cents - already_refunded;

      if unearned > 0 then
        insert into public.listing_request_closure_refund_items (
          closure_id, payment_id, unearned_amount_cents
        )
        values (new_closure_id, payment_row.id, unearned);

        new_flagged_ids := new_flagged_ids || payment_row.id;
      end if;
    end loop;
  end if;

  -- Fires listing_requests_close_conversation_when_cancelled (20260922_122).
  update public.listing_requests
  set
    status = 'cancelled',
    cancelled_at = close_time,
    cancelled_by_user_id = auth.uid(),
    cancellation_reason = clean_reason
  where listing_requests.id = p_request_id;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = p_request_id
  limit 1;

  if conversation_id is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      conversation_id,
      auth.uid(),
      'system',
      format(
        'This request was administratively closed (%s): %s. This is not a finding that the work delivered so far was satisfactory.%s',
        p_branch,
        clean_reason,
        case
          when p_branch = 'creator_unresponsive' and array_length(new_flagged_ids, 1) > 0 then
            ' Unearned prepaid amounts have been flagged for refund.'
          when p_branch = 'buyer_unresponsive' then
            ' Unearned prepaid amounts remain available to refund on request.'
          else ''
        end
      )
    );
  end if;

  return query
  select new_closure_id, p_branch, 'cancelled'::text, new_flagged_ids;
end;
$$;

revoke all on function public.admin_close_listing_request_for_non_response(uuid, text, uuid, text, uuid)
from public, anon, authenticated;

grant execute on function public.admin_close_listing_request_for_non_response(uuid, text, uuid, text, uuid)
to authenticated;

notify pgrst, 'reload schema';
