-- Sprint 5 (launch-scope.md section 6.5/6.6): recovery on subsequent
-- payments. Not a new money-movement primitive -- on a creator's later
-- payments, application_fee_amount is raised by the recovery instalment, the
-- same mechanism the platform fee already uses, capped at 50% of the base
-- payment so the creator always keeps something and the buyer of that
-- project still gets what they paid for.

alter table public.listing_request_payments
  add column if not exists recovery_instalment_cents integer not null default 0
    check (recovery_instalment_cents >= 0),
  add column if not exists recovery_instalment_applied_at timestamptz null;

-- Widen the application-fee check to include the recovery instalment. It is
-- deliberately not part of total_checkout_cents -- the buyer pays the same
-- total either way; the instalment comes off what would otherwise reach the
-- creator, exactly like the platform fee.
alter table public.listing_request_payments
  drop constraint if exists listing_request_payments_check;

alter table public.listing_request_payments
  add constraint listing_request_payments_check
  check (
    application_fee_cents =
      buyer_service_fee_cents
      + creator_platform_fee_cents
      + platform_support_cents
      + recovery_instalment_cents
  );

-- The recovery instalment for a given base amount, capped at 50% of that
-- base and at whatever is still outstanding. Zero when the creator has no
-- outstanding balance. Shared by both places that compute a payment's
-- amounts so they cannot diverge on this term the way
-- 20260922_120's own comment already requires for every other term.
create or replace function public.resolve_listing_request_payment_recovery_instalment(
  p_creator_user_id uuid,
  p_base_amount_cents integer
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    least(
      floor(p_base_amount_cents * 0.5)::integer,
      (
        select outstanding_cents
        from public.creator_recovery_balances
        where creator_user_id = p_creator_user_id
      )
    ),
    0
  );
$$;

revoke execute on function public.resolve_listing_request_payment_recovery_instalment(uuid, integer)
  from public, anon, authenticated;

-- Re-created with the recovery instalment folded into application_fee_cents.
-- Everything else is unchanged from 20260921_117.
create or replace function
public.ensure_listing_request_payment_for_schedule_item(
  p_payment_schedule_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  minimum_instalment_minor_units constant integer := 500;

  schedule_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  resolved record;

  existing_payment_id uuid;
  new_payment_id uuid;

  payment_type_value text;

  buyer_fee_bps_value integer;
  creator_fee_bps_value integer;
  buyer_fee_reason_value public.listing_request_fee_reason;
  creator_fee_reason_value public.listing_request_fee_reason;

  base_amount_cents_value integer;
  buyer_service_fee_cents_value integer;
  creator_platform_fee_cents_value integer;
  recovery_instalment_cents_value integer;
  application_fee_cents_value integer;
  total_checkout_cents_value integer;
begin
  select *
  into schedule_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
    p_payment_schedule_item_id;

  if not found then
    raise exception
      'Payment schedule item % was not found.',
      p_payment_schedule_item_id
      using errcode = 'P0001';
  end if;

  if schedule_row.status <> 'payment_required' then
    return null;
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
    schedule_row.agreement_id;

  if not found then
    raise exception
      'The agreement for payment schedule item % was not found.',
      schedule_row.id
      using errcode = 'P0001';
  end if;

  if agreement_row.status <> 'buyer_accepted' then
    return null;
  end if;

  select listing_request_payments.id
  into existing_payment_id
  from public.listing_request_payments
  where listing_request_payments.payment_schedule_item_id =
    schedule_row.id
  limit 1;

  if existing_payment_id is not null then
    return existing_payment_id;
  end if;

  payment_type_value :=
    case schedule_row.payment_timing
      when 'due_before_work_starts'
        then 'starting_payment'

      when 'due_at_milestone_approval'
        then 'milestone_payment'

      when 'due_on_change_order_acceptance'
        then 'change_order_payment'

      when 'due_before_final_release'
        then 'final_balance'

      else null
    end;

  if payment_type_value is null then
    raise exception
      'Unsupported payment timing: %.',
      schedule_row.payment_timing
      using errcode = 'P0001';
  end if;

  base_amount_cents_value :=
    round(schedule_row.amount * 100)::integer;

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

  recovery_instalment_cents_value :=
    public.resolve_listing_request_payment_recovery_instalment(
      agreement_row.creator_user_id,
      base_amount_cents_value
    );

  application_fee_cents_value :=
    buyer_service_fee_cents_value
    + creator_platform_fee_cents_value
    + recovery_instalment_cents_value;

  total_checkout_cents_value :=
    base_amount_cents_value
    + buyer_service_fee_cents_value;

  if application_fee_cents_value >= total_checkout_cents_value then
    raise exception
      'Payment amount % % is too small for the configured Made for Stream fees.',
      schedule_row.amount,
      upper(schedule_row.currency)
      using errcode = 'P0001';
  end if;

  insert into public.listing_request_payments (
    listing_request_id,
    payment_schedule_item_id,

    payment_type,
    status,
    currency,

    base_amount_cents,
    creator_tip_cents,

    buyer_service_fee_cents,
    creator_platform_fee_cents,
    platform_support_cents,
    recovery_instalment_cents,

    application_fee_cents,
    total_checkout_cents,

    buyer_service_fee_bps,
    creator_platform_fee_bps,

    buyer_service_fee_reason,
    creator_platform_fee_reason,

    buyer_service_fee_minimum_cents,
    creator_platform_fee_minimum_cents,

    payer_user_id,
    creator_user_id,

    metadata
  )
  values (
    agreement_row.listing_request_id,
    schedule_row.id,

    payment_type_value,
    'requires_checkout',
    lower(schedule_row.currency),

    base_amount_cents_value,
    0,

    buyer_service_fee_cents_value,
    creator_platform_fee_cents_value,
    0,
    recovery_instalment_cents_value,

    application_fee_cents_value,
    total_checkout_cents_value,

    buyer_fee_bps_value,
    creator_fee_bps_value,

    buyer_fee_reason_value,
    creator_fee_reason_value,

    0,
    0,

    agreement_row.buyer_user_id,
    agreement_row.creator_user_id,

    jsonb_build_object(
      'source',
      'payment_schedule_item',

      'agreement_id',
      agreement_row.id,

      'payment_schedule_item_id',
      schedule_row.id,

      'payment_timing',
      schedule_row.payment_timing,

      'payment_title',
      schedule_row.title
    )
  )
  on conflict do nothing
  returning id
  into new_payment_id;

  if new_payment_id is null then
    select listing_request_payments.id
    into new_payment_id
    from public.listing_request_payments
    where listing_request_payments.payment_schedule_item_id =
      schedule_row.id
    limit 1;
  end if;

  return new_payment_id;
end;
$$;

revoke execute on function public.ensure_listing_request_payment_for_schedule_item(uuid)
  from anon, authenticated;

-- Re-created with the recovery instalment folded in, following
-- 20260922_120's own rule that this must mirror
-- ensure_listing_request_payment_for_schedule_item exactly. Tip and support
-- are still preserved from the stored row (not recomputed), and the
-- recovery instalment is re-resolved fresh each time so a balance cleared
-- (or a new one opened) between payment creation and checkout is reflected
-- before Stripe is ever called.
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
  recovery_instalment_cents_value integer;
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

  if payment_row.status not in ('requires_checkout', 'checkout_opened') then
    return payment_row;
  end if;

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

  recovery_instalment_cents_value :=
    public.resolve_listing_request_payment_recovery_instalment(
      agreement_row.creator_user_id,
      base_amount_cents_value
    );

  application_fee_cents_value :=
    buyer_service_fee_cents_value
    + creator_platform_fee_cents_value
    + payment_row.platform_support_cents
    + recovery_instalment_cents_value;

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
    or payment_row.recovery_instalment_cents <> recovery_instalment_cents_value
    or payment_row.application_fee_cents <> application_fee_cents_value
    or payment_row.total_checkout_cents <> total_checkout_cents_value;

  if not amounts_changed then
    return payment_row;
  end if;

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
    recovery_instalment_cents = recovery_instalment_cents_value,

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

revoke all
on function
public.recompute_listing_request_payment_amounts(uuid)
from public, anon, authenticated;

-- Applies a paid payment's recovery instalment to the creator's balance.
-- Called once, from api/server.js, right after a payment is marked paid --
-- alongside applyPaidListingRequestPaymentWorkflow rather than inside it,
-- because this applies regardless of payment_type (including one_time,
-- which has no downstream project workflow). Idempotent via
-- recovery_instalment_applied_at, the same guard shape as the paid-workflow
-- retry path.
create or replace function public.apply_listing_request_payment_recovery_instalment(
  p_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.listing_request_payments%rowtype;
begin
  select *
  into payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0001';
  end if;

  if payment_row.status <> 'paid' then
    return;
  end if;

  if payment_row.recovery_instalment_cents <= 0
    or payment_row.recovery_instalment_applied_at is not null
  then
    return;
  end if;

  perform public.apply_creator_recovery_credit(
    payment_row.creator_user_id,
    payment_row.recovery_instalment_cents,
    payment_row.currency,
    format('Diverted from payment %s.', payment_row.id),
    'credit',
    payment_row.id,
    null
  );

  update public.listing_request_payments
  set recovery_instalment_applied_at = now()
  where listing_request_payments.id = payment_row.id;
end;
$$;

revoke all on function public.apply_listing_request_payment_recovery_instalment(uuid)
  from public, anon, authenticated;

grant execute on function public.apply_listing_request_payment_recovery_instalment(uuid)
  to service_role;

notify pgrst, 'reload schema';
