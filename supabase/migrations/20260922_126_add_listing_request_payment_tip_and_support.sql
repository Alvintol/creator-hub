-- Sprint 5 (launch-scope.md section 4): tips and optional platform support.
--
-- The columns, the constraints and the checkout page's display branches all
-- already exist and are correct -- what is missing is a write path. This is
-- it: a buyer-only RPC that sets creator_tip_cents / platform_support_cents
-- on their own payment while it is still awaiting checkout, recomputing
-- total_checkout_cents and application_fee_cents in the same statement so
-- the row's own check constraints hold at every commit.
--
-- Both default to zero and this function must be called with an explicit
-- choice to satisfy "must be affirmatively chosen" -- the checkout page
-- gates opening Stripe Checkout on the buyer having gone through this step
-- (see ListingRequestPaymentCheckout.tsx), not on this function alone.
--
-- Reissuing the Stripe session needs no separate route: the existing
-- POST /api/stripe/checkout/session already calls
-- recompute_listing_request_payment_amounts (20260922_120) before every
-- session creation, which was already written to preserve stored tip/support
-- values rather than recompute them to zero, and its idempotency key is
-- keyed on updated_at -- which this function bumps. If checkout was already
-- opened against the old amount, this function resets it to
-- requires_checkout and clears the stale session id, the same way
-- recompute_listing_request_payment_amounts does when it finds drift, so the
-- next checkout/session call creates a fresh one at the new total instead of
-- reusing (or silently keeping) a session built from the old amount.
create or replace function public.set_listing_request_payment_tip_and_support(
  p_payment_id uuid,
  p_creator_tip_cents integer,
  p_platform_support_cents integer
)
returns public.listing_request_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.listing_request_payments%rowtype;
  new_application_fee_cents integer;
  new_total_checkout_cents integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to set a tip or contribution.'
      using errcode = '42501';
  end if;

  if p_creator_tip_cents is null or p_creator_tip_cents < 0 then
    raise exception 'Tip amount must be zero or greater.'
      using errcode = '22023';
  end if;

  if p_platform_support_cents is null or p_platform_support_cents < 0 then
    raise exception 'Contribution amount must be zero or greater.'
      using errcode = '22023';
  end if;

  select *
  into payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id
    and listing_request_payments.payer_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Payment not found or not accessible.'
      using errcode = 'P0001';
  end if;

  if payment_row.status not in ('requires_checkout', 'checkout_opened') then
    raise exception
      'A tip or contribution can only be set before checkout is completed.'
      using errcode = 'P0001';
  end if;

  -- Tips and contributions sit outside the fee calculation entirely
  -- (section 3.1) -- they never change buyer_service_fee_cents or
  -- creator_platform_fee_cents, which is why they are the only two terms
  -- touched here. The tip is excluded from application_fee_cents so it
  -- reaches the creator in full; the contribution is included so it reaches
  -- Made for Stream, matching the schema's existing check constraints.
  new_application_fee_cents :=
    payment_row.buyer_service_fee_cents
    + payment_row.creator_platform_fee_cents
    + p_platform_support_cents;

  new_total_checkout_cents :=
    payment_row.base_amount_cents
    + p_creator_tip_cents
    + payment_row.buyer_service_fee_cents
    + p_platform_support_cents;

  if new_application_fee_cents >= new_total_checkout_cents then
    raise exception
      'This payment amount is too small for the configured Made for Stream fees.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_payments
  set
    creator_tip_cents = p_creator_tip_cents,
    platform_support_cents = p_platform_support_cents,
    application_fee_cents = new_application_fee_cents,
    total_checkout_cents = new_total_checkout_cents,

    status = case
      when payment_row.status = 'checkout_opened' then 'requires_checkout'
      else payment_row.status
    end,
    stripe_checkout_session_id = case
      when payment_row.status = 'checkout_opened' then null
      else payment_row.stripe_checkout_session_id
    end,

    updated_at = now()
  where listing_request_payments.id = payment_row.id
  returning * into payment_row;

  return payment_row;
end;
$$;

revoke all on function public.set_listing_request_payment_tip_and_support(uuid, integer, integer)
  from public, anon, authenticated;

grant execute on function public.set_listing_request_payment_tip_and_support(uuid, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
