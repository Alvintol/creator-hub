-- Recompute a payment's base, fees and recipient from authoritative rows
-- before Stripe Checkout ever opens for it, rather than trusting the stored
-- ledger values (launch-scope.md section 11: "The checkout API trusts stored
-- fee values... it does not recompute the fee from the base [and] the
-- currency registry and the monthly-minimum state").
--
-- The currency registry and monthly-minimum state referenced there do not
-- exist yet (they are Sprint 1/2 work). What this closes today is the gap
-- that actually exists now: nothing re-derives base_amount_cents, the fee
-- bps/cents or total_checkout_cents from the payment_schedule_item and
-- agreement a payment was created from, so a stale or directly-edited row
-- would be trusted as-is all the way to a real Stripe charge. This mirrors
-- ensure_listing_request_payment_for_schedule_item's arithmetic exactly
-- (20260921_117) so the two can never quietly diverge in what "correct"
-- means.
--
-- Recipient identity (payer_user_id, creator_user_id, listing_request_id)
-- is verified, not recomputed -- a mismatch there is not something that
-- "changed since creation" in any legitimate way, so it raises rather than
-- silently repoints who a real charge would pay.
create or replace function
public.recompute_listing_request_payment_amounts(
  p_payment_id uuid
)
returns public.listing_request_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  minimum_instalment_minor_units constant integer := 500;

  payment_row
    public.listing_request_payments%rowtype;

  schedule_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  resolved record;

  buyer_fee_bps_value integer;
  creator_fee_bps_value integer;
  buyer_fee_reason_value public.listing_request_fee_reason;
  creator_fee_reason_value public.listing_request_fee_reason;

  base_amount_cents_value integer;
  buyer_service_fee_cents_value integer;
  creator_platform_fee_cents_value integer;
  application_fee_cents_value integer;
  total_checkout_cents_value integer;

  currency_value text;

  amounts_changed boolean;
begin
  select *
  into payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id
  for update;

  if not found then
    raise exception
      'Payment % was not found.', p_payment_id
      using errcode = 'P0001';
  end if;

  -- Only a payment still awaiting Checkout can be corrected. Anything past
  -- that (processing, paid, failed, refunded, ...) is settled against
  -- whatever Stripe actually did, and silently rewriting it now would make
  -- the ledger disagree with the real charge instead of agreeing with it.
  if payment_row.status not in ('requires_checkout', 'checkout_opened') then
    return payment_row;
  end if;

  -- one_time payments (no schedule item behind them) have no authoritative
  -- source to recompute against. The one_time payment_type exists in the
  -- schema with no workflow behind it (launch-scope.md section 2) and stays
  -- unreachable, so this is a no-op today, not a gap.
  if payment_row.payment_schedule_item_id is null then
    return payment_row;
  end if;

  select *
  into schedule_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
    payment_row.payment_schedule_item_id;

  if not found then
    raise exception
      'The payment schedule item for payment % was not found.',
      payment_row.id
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = schedule_row.agreement_id;

  if not found then
    raise exception
      'The agreement for payment % was not found.', payment_row.id
      using errcode = 'P0001';
  end if;

  -- The recipient must be exactly who the agreement says. This is not a
  -- value that legitimately drifts after payment creation -- a mismatch
  -- means the row was corrupted or tampered with, and checkout must refuse
  -- rather than proceed against a recomputed guess.
  if payment_row.listing_request_id <> agreement_row.listing_request_id
    or payment_row.payer_user_id <> agreement_row.buyer_user_id
    or payment_row.creator_user_id <> agreement_row.creator_user_id
  then
    raise exception
      'Payment % does not match its agreement''s buyer and creator.',
      payment_row.id
      using errcode = 'P0001';
  end if;

  currency_value := lower(schedule_row.currency);

  base_amount_cents_value := round(schedule_row.amount * 100)::integer;

  if base_amount_cents_value <= 0 then
    raise exception
      'Payment-required schedule items must have an amount greater than zero.'
      using errcode = 'P0001';
  end if;

  if base_amount_cents_value < minimum_instalment_minor_units then
    raise exception
      'Each payment must be at least % %.',
      to_char(minimum_instalment_minor_units / 100.0, 'FM999990.00'),
      upper(schedule_row.currency)
      using errcode = 'P0001';
  end if;

  select *
  into resolved
  from public.resolve_listing_request_fee_rates(
    agreement_row.buyer_user_id,
    agreement_row.creator_user_id
  );

  -- Same ceiling logic as ensure_listing_request_payment_for_schedule_item:
  -- the rate locked at agreement acceptance is a ceiling, a later waiver may
  -- lower it, nothing may raise it.
  buyer_fee_bps_value := least(
    coalesce(
      agreement_row.buyer_service_fee_bps,
      resolved.buyer_service_fee_bps
    ),
    resolved.buyer_service_fee_bps
  );

  creator_fee_bps_value := least(
    coalesce(
      agreement_row.creator_platform_fee_bps,
      resolved.creator_platform_fee_bps
    ),
    resolved.creator_platform_fee_bps
  );

  buyer_fee_reason_value := case
    when agreement_row.buyer_service_fee_bps is not null
      and agreement_row.buyer_service_fee_bps = buyer_fee_bps_value
      then coalesce(
        agreement_row.buyer_service_fee_reason,
        resolved.buyer_service_fee_reason
      )
    else resolved.buyer_service_fee_reason
  end;

  creator_fee_reason_value := case
    when agreement_row.creator_platform_fee_bps is not null
      and agreement_row.creator_platform_fee_bps = creator_fee_bps_value
      then coalesce(
        agreement_row.creator_platform_fee_reason,
        resolved.creator_platform_fee_reason
      )
    else resolved.creator_platform_fee_reason
  end;

  buyer_service_fee_cents_value :=
    ceil(
      (base_amount_cents_value::numeric * buyer_fee_bps_value) / 10000
    )::integer;

  creator_platform_fee_cents_value :=
    ceil(
      (base_amount_cents_value::numeric * creator_fee_bps_value) / 10000
    )::integer;

  -- Tips and platform support are buyer-chosen additions with no schedule-item
  -- source (launch-scope.md section 4, not yet built) -- preserved as stored
  -- rather than recomputed to zero.
  application_fee_cents_value :=
    buyer_service_fee_cents_value
    + creator_platform_fee_cents_value
    + payment_row.platform_support_cents;

  total_checkout_cents_value :=
    base_amount_cents_value
    + payment_row.creator_tip_cents
    + buyer_service_fee_cents_value
    + payment_row.platform_support_cents;

  if application_fee_cents_value >= total_checkout_cents_value then
    raise exception
      'Payment amount % % is too small for the configured Made for Stream fees.',
      schedule_row.amount,
      upper(schedule_row.currency)
      using errcode = 'P0001';
  end if;

  amounts_changed :=
    payment_row.currency <> currency_value
    or payment_row.base_amount_cents <> base_amount_cents_value
    or payment_row.buyer_service_fee_cents <> buyer_service_fee_cents_value
    or payment_row.creator_platform_fee_cents <> creator_platform_fee_cents_value
    or payment_row.buyer_service_fee_bps <> buyer_fee_bps_value
    or payment_row.creator_platform_fee_bps <> creator_fee_bps_value
    or payment_row.application_fee_cents <> application_fee_cents_value
    or payment_row.total_checkout_cents <> total_checkout_cents_value;

  if not amounts_changed then
    return payment_row;
  end if;

  -- A drift was found. If Checkout was already opened, that session was
  -- built from the wrong numbers -- clear it so the caller creates a fresh
  -- one from the corrected row rather than either reusing a session with a
  -- stale amount or charging the corrected amount into an old session.
  update public.listing_request_payments
  set
    status = case
      when payment_row.status = 'checkout_opened' then 'requires_checkout'
      else payment_row.status
    end,
    stripe_checkout_session_id = case
      when payment_row.status = 'checkout_opened' then null
      else payment_row.stripe_checkout_session_id
    end,

    currency = currency_value,
    base_amount_cents = base_amount_cents_value,

    buyer_service_fee_cents = buyer_service_fee_cents_value,
    creator_platform_fee_cents = creator_platform_fee_cents_value,

    application_fee_cents = application_fee_cents_value,
    total_checkout_cents = total_checkout_cents_value,

    buyer_service_fee_bps = buyer_fee_bps_value,
    creator_platform_fee_bps = creator_fee_bps_value,

    buyer_service_fee_reason = buyer_fee_reason_value,
    creator_platform_fee_reason = creator_fee_reason_value,

    updated_at = now()
  where listing_request_payments.id = payment_row.id
  returning * into payment_row;

  return payment_row;
end;
$$;

-- Called by the API's checkout-session route only, with the service role.
-- "revoke ... from public" alone does not remove EXECUTE from anon/authenticated
-- on Supabase (20260921_118's finding) -- both are revoked explicitly.
revoke all
on function
public.recompute_listing_request_payment_amounts(uuid)
from public, anon, authenticated;
