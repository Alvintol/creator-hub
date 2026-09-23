-- Sprint 5 (launch-scope.md section 6): refund execution.
--
-- The current ledger cannot represent a partial refund -- a single nullable
-- stripe_refund_id and a single refunded_at, no refunded amount, no history
-- (docs/support/payments/refunds-and-disputes.md). This adds an immutable
-- refund ledger, one row per Stripe refund, and derives status from it rather
-- than writing status directly, so it cannot drift from what Stripe actually
-- did.
--
-- The ledger also carries tip and platform-support refund amounts alongside
-- the base/fee ones (section 4 / Refund Policy section 8). They are never
-- auto-computed the way the proportional base/fee arithmetic is -- a partial
-- refund does not prorate a tip or contribution automatically, so a caller
-- must explicitly say how much of each to return. This is the same event,
-- because a single Stripe refund on the underlying charge is the actual
-- money movement for all four components at once.

create table if not exists public.listing_request_payment_refunds (
  id uuid primary key default gen_random_uuid(),

  payment_id uuid not null references public.listing_request_payments(id) on delete cascade,

  stripe_refund_id text not null,
  stripe_application_fee_refund_id text null,

  -- Proportional per section 6.2, computed cumulatively by
  -- apply_refunded_listing_request_payment -- never written directly by a
  -- client.
  base_refund_cents integer not null check (base_refund_cents > 0),
  buyer_fee_refund_cents integer not null default 0 check (buyer_fee_refund_cents >= 0),
  creator_fee_reversal_cents integer not null default 0 check (creator_fee_reversal_cents >= 0),

  -- Never auto-computed. A partial base refund defaults these to 0; a full
  -- cancellation-style refund (or an explicit tip/contribution refund
  -- request) passes the amount being returned.
  tip_refund_cents integer not null default 0 check (tip_refund_cents >= 0),
  contribution_refund_cents integer not null default 0 check (contribution_refund_cents >= 0),

  currency text not null,

  reason text not null check (
    char_length(btrim(reason)) >= 3
    and char_length(btrim(reason)) <= 500
  ),

  -- 'admin': issued by an admin through the app's refund route.
  -- 'cancellation_cascade': the automatic settlement of a Sprint 4 accepted
  --   cancellation proposal's flagged unearned amounts.
  -- 'system_auto_refund': issued by the server itself with no human actor --
  --   currently only CAN-005 (a Stripe checkout session that completed
  --   after its listing request was already cancelled).
  -- 'webhook_external': recorded from a charge.refunded event for a refund
  --   this app did not initiate (issued by hand in Stripe). Its base amount
  --   is the whole Stripe refund amount (a best-effort attribution, since
  --   Stripe has no concept of "base" vs "fee" for a refund it didn't
  --   receive from our own admin route) -- see recordChargeRefundedFromWebhook
  --   in api/server.js and REF-002 in the refunds playbook.
  initiated_via text not null check (
    initiated_via in ('admin', 'cancellation_cascade', 'system_auto_refund', 'webhook_external')
  ),

  -- null for a system-initiated refund (cascade, external reconciliation).
  actor_user_id uuid null references public.profiles(user_id),

  created_at timestamptz not null default now(),

  unique (stripe_refund_id)
);

create index if not exists listing_request_payment_refunds_payment_idx
  on public.listing_request_payment_refunds(payment_id, created_at);

alter table public.listing_request_payment_refunds enable row level security;

drop policy if exists "listing request payment refunds participants read"
  on public.listing_request_payment_refunds;

create policy "listing request payment refunds participants read"
  on public.listing_request_payment_refunds
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listing_request_payments
      where listing_request_payments.id = listing_request_payment_refunds.payment_id
        and (
          listing_request_payments.payer_user_id = auth.uid()
          or listing_request_payments.creator_user_id = auth.uid()
          or public.is_admin_user(auth.uid())
        )
    )
  );

-- No insert/update/delete policy for any client role -- every write goes
-- through apply_refunded_listing_request_payment below, matching every other
-- workflow ledger in this schema.

-- The single place a payment's refund status is decided, from the ledger's
-- own sum rather than from whatever the caller believes happened. Internal --
-- only ever called from apply_refunded_listing_request_payment, in the same
-- transaction as the ledger insert.
create or replace function public.derive_listing_request_payment_refund_status(
  p_payment_id uuid
)
returns table (
  status text,
  cumulative_base_refunded_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.listing_request_payments%rowtype;
  refunded_cents integer;
begin
  select *
  into payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id;

  select coalesce(sum(base_refund_cents), 0)
  into refunded_cents
  from public.listing_request_payment_refunds
  where listing_request_payment_refunds.payment_id = p_payment_id;

  return query
  select
    case
      when refunded_cents >= payment_row.base_amount_cents then 'refunded'
      when refunded_cents > 0 then 'partially_refunded'
      else payment_row.status
    end,
    refunded_cents;
end;
$$;

revoke execute on function public.derive_listing_request_payment_refund_status(uuid)
  from public, anon, authenticated;

-- The refund engine. Writes one immutable ledger row, derives status from
-- the ledger's own sum, and applies what section 6.7 says a refund does to
-- the project. Service-role only -- see apply_paid_listing_request_starting_payment
-- for the same shape on the paid side.
--
-- Idempotent on stripe_refund_id: a webhook redelivery, or the webhook
-- arriving after this function was already called synchronously by the
-- admin refund route for the same Stripe refund, is a no-op that returns the
-- existing row rather than double-counting.
--
-- p_tip_refund_cents / p_contribution_refund_cents are never derived from
-- p_base_refund_cents -- Refund Policy section 8 does not prorate them on a
-- partial refund. A caller doing a full cancellation-style refund passes the
-- remaining tip/contribution explicitly; an ordinary partial base refund
-- passes 0 for both (the default).
create or replace function public.apply_refunded_listing_request_payment(
  p_payment_id uuid,
  p_base_refund_cents integer,
  p_stripe_refund_id text,
  p_reason text,
  p_initiated_via text,
  p_actor_user_id uuid default null,
  p_stripe_application_fee_refund_id text default null,
  p_tip_refund_cents integer default 0,
  p_contribution_refund_cents integer default 0,
  p_tip_contribution_override_reason text default null,
  p_refunded_at timestamptz default now()
)
returns table (
  refund_id uuid,
  payment_id uuid,
  status text,
  cumulative_base_refunded_cents integer,
  buyer_fee_refund_cents integer,
  creator_fee_reversal_cents integer,
  listing_request_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.listing_request_payments%rowtype;
  request_row public.listing_requests%rowtype;

  existing_refund_id uuid;

  already_base_refunded integer;
  already_buyer_fee_refunded integer;
  already_creator_fee_reversed integer;
  already_tip_refunded integer;
  already_contribution_refunded integer;

  cumulative_base integer;
  buyer_fee_cumulative integer;
  creator_fee_cumulative integer;

  this_buyer_fee_refund integer;
  this_creator_fee_reversal integer;

  new_refund_id uuid;
  derived record;

  request_has_remaining_paid boolean;
begin
  if p_initiated_via not in ('admin', 'cancellation_cascade', 'system_auto_refund', 'webhook_external') then
    raise exception 'Unknown refund initiator: %.', p_initiated_via
      using errcode = '22023';
  end if;

  select *
  into payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0001';
  end if;

  -- Idempotent replay: this exact Stripe refund has already been recorded,
  -- whether by this same call path retrying or by the webhook arriving
  -- after the admin route already wrote it synchronously.
  select id
  into existing_refund_id
  from public.listing_request_payment_refunds
  where listing_request_payment_refunds.stripe_refund_id = p_stripe_refund_id;

  if existing_refund_id is not null then
    select derived.status, derived.cumulative_base_refunded_cents
    into derived
    from public.derive_listing_request_payment_refund_status(p_payment_id) as derived;

    return query
    select
      existing_refund_id,
      payment_row.id,
      payment_row.status,
      derived.cumulative_base_refunded_cents,
      (
        select buyer_fee_refund_cents
        from public.listing_request_payment_refunds
        where id = existing_refund_id
      ),
      (
        select creator_fee_reversal_cents
        from public.listing_request_payment_refunds
        where id = existing_refund_id
      ),
      payment_row.listing_request_id,
      (
        select status from public.listing_requests
        where id = payment_row.listing_request_id
      );
    return;
  end if;

  if payment_row.status not in ('paid', 'partially_refunded') then
    raise exception
      'Payment % is not in a refundable state (currently %).',
      payment_row.id, payment_row.status
      using errcode = 'P0001';
  end if;

  if p_base_refund_cents is null or p_base_refund_cents <= 0 then
    raise exception 'A refund must have a base amount greater than zero.'
      using errcode = '22023';
  end if;

  select coalesce(sum(base_refund_cents), 0),
         coalesce(sum(buyer_fee_refund_cents), 0),
         coalesce(sum(creator_fee_reversal_cents), 0),
         coalesce(sum(tip_refund_cents), 0),
         coalesce(sum(contribution_refund_cents), 0)
  into already_base_refunded,
       already_buyer_fee_refunded,
       already_creator_fee_reversed,
       already_tip_refunded,
       already_contribution_refunded
  from public.listing_request_payment_refunds
  where listing_request_payment_refunds.payment_id = p_payment_id;

  cumulative_base := already_base_refunded + p_base_refund_cents;

  if cumulative_base > payment_row.base_amount_cents then
    raise exception
      'Refunding % cents would exceed the % cents base amount actually paid (% already refunded).',
      p_base_refund_cents, payment_row.base_amount_cents, already_base_refunded
      using errcode = '22023';
  end if;

  if already_tip_refunded + coalesce(p_tip_refund_cents, 0) > payment_row.creator_tip_cents then
    raise exception 'Tip refund would exceed the tip actually paid.'
      using errcode = '22023';
  end if;

  if already_contribution_refunded + coalesce(p_contribution_refund_cents, 0)
      > payment_row.platform_support_cents then
    raise exception 'Contribution refund would exceed the contribution actually paid.'
      using errcode = '22023';
  end if;

  -- Refund Policy section 8 / launch-scope.md section 4: a full project
  -- cancellation returns tips and contributions with no time limit. A
  -- partial refund does not auto-prorate them -- the buyer can request them
  -- back within 14 days of the contribution or the project's cancellation
  -- (whichever is later), and outside that window only when the override
  -- reason is mistaken, duplicate or unauthorised. This only gates a
  -- *partial* base refund; a refund that fully covers the base (checked
  -- below, once cumulative_base is known) is a full-cancellation-style
  -- refund and is exempt.
  if (coalesce(p_tip_refund_cents, 0) > 0 or coalesce(p_contribution_refund_cents, 0) > 0)
    and cumulative_base < payment_row.base_amount_cents
    and p_tip_contribution_override_reason is null
  then
    select *
    into request_row
    from public.listing_requests
    where listing_requests.id = payment_row.listing_request_id;

    if not (
      (payment_row.paid_at is not null and now() <= payment_row.paid_at + interval '14 days')
      or (request_row.cancelled_at is not null and now() <= request_row.cancelled_at + interval '14 days')
    ) then
      raise exception
        'A tip or contribution can only be refunded within 14 days of payment or cancellation, or with a mistaken/duplicate/unauthorised override.'
        using errcode = 'P0001';
    end if;
  elsif p_tip_contribution_override_reason is not null
    and p_tip_contribution_override_reason not in ('mistaken', 'duplicate', 'unauthorised')
  then
    raise exception 'Unknown tip/contribution refund override reason: %.',
      p_tip_contribution_override_reason
      using errcode = '22023';
  end if;

  -- Section 6.2: cumulative proportional fee, rounded once against the
  -- original fee, with a final full refund returning any rounding
  -- remainder exactly rather than through the rounded ratio.
  if cumulative_base >= payment_row.base_amount_cents then
    buyer_fee_cumulative := payment_row.buyer_service_fee_cents;
    creator_fee_cumulative := payment_row.creator_platform_fee_cents;
  else
    buyer_fee_cumulative := round(
      payment_row.buyer_service_fee_cents::numeric * cumulative_base
      / payment_row.base_amount_cents
    )::integer;

    creator_fee_cumulative := round(
      payment_row.creator_platform_fee_cents::numeric * cumulative_base
      / payment_row.base_amount_cents
    )::integer;
  end if;

  this_buyer_fee_refund := buyer_fee_cumulative - already_buyer_fee_refunded;
  this_creator_fee_reversal := creator_fee_cumulative - already_creator_fee_reversed;

  insert into public.listing_request_payment_refunds (
    payment_id,
    stripe_refund_id,
    stripe_application_fee_refund_id,
    base_refund_cents,
    buyer_fee_refund_cents,
    creator_fee_reversal_cents,
    tip_refund_cents,
    contribution_refund_cents,
    currency,
    reason,
    initiated_via,
    actor_user_id,
    created_at
  )
  values (
    p_payment_id,
    p_stripe_refund_id,
    p_stripe_application_fee_refund_id,
    p_base_refund_cents,
    greatest(this_buyer_fee_refund, 0),
    greatest(this_creator_fee_reversal, 0),
    coalesce(p_tip_refund_cents, 0),
    coalesce(p_contribution_refund_cents, 0),
    payment_row.currency,
    btrim(p_reason),
    p_initiated_via,
    p_actor_user_id,
    p_refunded_at
  )
  returning id into new_refund_id;

  select derived.status, derived.cumulative_base_refunded_cents
  into derived
  from public.derive_listing_request_payment_refund_status(p_payment_id) as derived;

  update public.listing_request_payments
  set
    status = derived.status,
    stripe_refund_id = p_stripe_refund_id,
    refunded_at = p_refunded_at,
    updated_at = now()
  where listing_request_payments.id = p_payment_id;

  -- Close the loop Sprint 4 opened: a cancellation-proposal item flagged for
  -- refund is marked refunded once a refund covering at least its unearned
  -- amount has been recorded against the same payment.
  update public.listing_request_cancellation_proposal_items
  set refunded_at = p_refunded_at
  where listing_request_cancellation_proposal_items.payment_id = p_payment_id
    and listing_request_cancellation_proposal_items.is_operative = true
    and listing_request_cancellation_proposal_items.flagged_for_refund_at is not null
    and listing_request_cancellation_proposal_items.refunded_at is null
    and listing_request_cancellation_proposal_items.unearned_amount_cents <= derived.cumulative_base_refunded_cents;

  -- Section 6.7: what a refund does to the project. A milestone payment
  -- being refunded at all -- partial or full -- means that milestone is no
  -- longer being honoured economically.
  if payment_row.payment_type = 'milestone_payment'
    and payment_row.related_entity_type = 'milestone'
    and payment_row.related_entity_id is not null
  then
    update public.listing_request_milestones
    set
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, p_refunded_at),
      updated_at = p_refunded_at
    where listing_request_milestones.id = payment_row.related_entity_id
      and listing_request_milestones.status <> 'cancelled';
  end if;

  select *
  into request_row
  from public.listing_requests
  where listing_requests.id = payment_row.listing_request_id
  for update;

  -- Never move a completed request backward -- there is no un-approval path
  -- (section 6.7's last row), and a refund after final delivery approval
  -- carries a refund record on an otherwise-completed request.
  if request_row.status not in ('cancelled', 'declined', 'completed') then
    select not exists (
      select 1
      from public.listing_request_payments
      where listing_request_payments.listing_request_id = request_row.id
        and listing_request_payments.status in ('paid', 'partially_refunded')
    )
    into request_has_remaining_paid;

    -- Covers section 6.7's "full refund of the starting payment before
    -- work" and "full refund of every collected payment" rows with one
    -- rule: once nothing paid remains unrefunded, the project is over.
    if request_has_remaining_paid then
      update public.listing_request_agreements
      set status = 'cancelled', cancelled_at = p_refunded_at
      where listing_request_agreements.listing_request_id = request_row.id
        and listing_request_agreements.status = 'buyer_accepted';

      update public.listing_requests
      set
        status = 'cancelled',
        cancelled_at = p_refunded_at,
        cancelled_by_user_id = coalesce(p_actor_user_id, request_row.creator_user_id),
        cancellation_reason = left(
          coalesce(request_row.cancellation_reason, '') || case
            when request_row.cancellation_reason is null or request_row.cancellation_reason = ''
              then 'Refunded in full.'
            else ' Refunded in full.'
          end,
          1000
        )
      where listing_requests.id = request_row.id
        and listing_requests.status not in ('cancelled', 'declined', 'completed');

      select * into request_row from public.listing_requests where id = request_row.id;
    end if;
  end if;

  return query
  select
    new_refund_id,
    payment_row.id,
    derived.status,
    derived.cumulative_base_refunded_cents,
    greatest(this_buyer_fee_refund, 0),
    greatest(this_creator_fee_reversal, 0),
    payment_row.listing_request_id,
    request_row.status;
end;
$$;

revoke all on function public.apply_refunded_listing_request_payment(
  uuid, integer, text, text, text, uuid, text, integer, integer, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_refunded_listing_request_payment(
  uuid, integer, text, text, text, uuid, text, integer, integer, text, timestamptz
) to service_role;

notify pgrst, 'reload schema';
