-- Sprint 6: closes the loop this sprint opened, the same way 20260922_125
-- already closes Sprint 4's -- a listing_request_closure_refund_items row
-- flagged for refund is marked refunded once a refund covering at least its
-- unearned amount has been recorded against the same payment. This can only
-- be done as a full create-or-replace of
-- apply_refunded_listing_request_payment (Postgres has no way to patch one
-- statement into an existing function body), so the rest of the function
-- below is reproduced unchanged from 20260922_125 -- the only addition is
-- the new update block immediately after the existing
-- listing_request_cancellation_proposal_items one.
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
  if p_initiated_via not in ('admin', 'cancellation_cascade', 'system_auto_refund', 'webhook_external', 'closure_cascade') then
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

  -- Sprint 6: same loop-closing for an administrative-closure refund item.
  update public.listing_request_closure_refund_items
  set refunded_at = p_refunded_at
  where listing_request_closure_refund_items.payment_id = p_payment_id
    and listing_request_closure_refund_items.flagged_for_refund_at is not null
    and listing_request_closure_refund_items.refunded_at is null
    and listing_request_closure_refund_items.unearned_amount_cents <= derived.cumulative_base_refunded_cents;

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
