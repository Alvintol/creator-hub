-- Fee structure: 5% buyer + 5% creator, no minimums, rates resolved per user.
--
-- Three changes, all from launch-scope.md section 3:
--
--   1. The flat fee minimums are removed (3.1). They existed to protect platform
--      margin, then to offset Stripe's CA$2 monthly active account fee. Under the
--      "Stripe handles pricing" Connect model (3.4) that cost does not exist: the
--      platform collects the application fee and pays Stripe nothing, so it cannot
--      lose money on a transaction at any size. All the minimum still did was take
--      from creators on small commissions -- at a CAD 2.00 base it left them 7% of
--      the base instead of 77%.
--
--   2. Rates are resolved per user rather than written as the literal 500 (3.5,
--      3.6). The resolver returns 500 bps for everyone today. It exists so that a
--      future buyer or creator subscription is a change to data and to one
--      function, not a rewrite of this trigger.
--
--   3. The rate in force is locked onto the agreement when the buyer accepts it,
--      and acts as a ceiling. Fee Schedule section 2 requires the agreement to show
--      estimated fees before acceptance and section 8 forbids silently repricing an
--      accepted obligation, so a buyer who accepts at a waived rate must not find
--      later milestones charged at the standard rate because a subscription lapsed.
--      A later waiver may lower the rate; nothing may raise it.


-- Why a rate applied. A zero rate with no reason is indistinguishable from a bug,
-- and support cannot tell a subscriber from a defect.
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'listing_request_fee_reason'
  ) then
    create type public.listing_request_fee_reason as enum (
      'standard',
      'subscription',
      'promotional',
      'goodwill'
    );
  end if;
end;
$$;


-- The single place a fee rate is decided. Returns the standard rate for everyone
-- today; a subscription or promotion changes this function and nothing else.
--
-- Buyer and creator rates are the same question asked of different parties, so
-- they are resolved together rather than by two functions that can drift apart.
create or replace function public.resolve_listing_request_fee_rates(
  p_buyer_user_id uuid,
  p_creator_user_id uuid
)
returns table (
  buyer_service_fee_bps integer,
  buyer_service_fee_reason public.listing_request_fee_reason,
  creator_platform_fee_bps integer,
  creator_platform_fee_reason public.listing_request_fee_reason
)
language sql
stable
security definer
set search_path = public
as $$
  select
    500::integer,
    'standard'::public.listing_request_fee_reason,
    500::integer,
    'standard'::public.listing_request_fee_reason;
$$;

revoke all on function public.resolve_listing_request_fee_rates(uuid, uuid) from public;


-- The rate in force at acceptance, recorded on the agreement.
alter table public.listing_request_agreements
  add column if not exists buyer_service_fee_bps integer null
    check (buyer_service_fee_bps is null or buyer_service_fee_bps >= 0),
  add column if not exists buyer_service_fee_reason
    public.listing_request_fee_reason null,
  add column if not exists creator_platform_fee_bps integer null
    check (creator_platform_fee_bps is null or creator_platform_fee_bps >= 0),
  add column if not exists creator_platform_fee_reason
    public.listing_request_fee_reason null,
  add column if not exists fee_rates_locked_at timestamptz null;


-- Why a rate applied, on the payment itself, so a historical charge can be
-- explained without reconstructing what the rules were at the time.
alter table public.listing_request_payments
  add column if not exists buyer_service_fee_reason
    public.listing_request_fee_reason not null default 'standard',
  add column if not exists creator_platform_fee_reason
    public.listing_request_fee_reason not null default 'standard';

-- Existing rows keep the minimum they were charged under; new rows record zero,
-- because that is now the rule. The columns stay as an honest snapshot of what
-- applied rather than being dropped.
alter table public.listing_request_payments
  alter column buyer_service_fee_minimum_cents set default 0,
  alter column creator_platform_fee_minimum_cents set default 0;


-- Stamp the rates when the buyer accepts. BEFORE UPDATE so the values are present
-- on the row by the time the AFTER UPDATE trigger creates payment rows from it.
create or replace function public.lock_listing_request_agreement_fee_rates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved record;
begin
  if new.status = 'buyer_accepted'
    and old.status is distinct from new.status
    and new.fee_rates_locked_at is null
  then
    select *
    into resolved
    from public.resolve_listing_request_fee_rates(
      new.buyer_user_id,
      new.creator_user_id
    );

    new.buyer_service_fee_bps := resolved.buyer_service_fee_bps;
    new.buyer_service_fee_reason := resolved.buyer_service_fee_reason;
    new.creator_platform_fee_bps := resolved.creator_platform_fee_bps;
    new.creator_platform_fee_reason := resolved.creator_platform_fee_reason;
    new.fee_rates_locked_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.lock_listing_request_agreement_fee_rates() from public;

drop trigger if exists listing_request_agreements_lock_fee_rates
  on public.listing_request_agreements;

create trigger listing_request_agreements_lock_fee_rates
  before update of status
  on public.listing_request_agreements
  for each row
  execute function public.lock_listing_request_agreement_fee_rates();


-- Rewritten fee calculation. Differences from 20260905_110:
--
--   * no greatest(..., 100) / greatest(..., 150) -- the minimums are gone
--   * rates come from the resolver, capped by the agreement's locked rate
--   * the reason for each rate is recorded on the payment
--   * a minimum instalment is enforced, with a message that says the amount
--
-- The minimum instalment now protects the *creator* rather than the platform.
-- Stripe's flat CAD 0.30 is charged to the creator's connected account, and on a
-- tiny payment it is most of what they would receive. At a 5.00 base the creator
-- keeps about 86% of it, which is a defensible worst case.
--
-- 500 minor units is correct for CAD and USD. It moves to the currency registry
-- when a currency with a different minor unit is enabled -- see launch-scope.md
-- section 1.1.
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

  -- A pending/paid/waived/cancelled item does not need Checkout.
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

  -- Payment rows must not become payable until the buyer has accepted
  -- the project agreement.
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

  -- Agreement amounts are stored in major currency units.
  -- Stripe payment amounts are stored in integer minor units.
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

  -- The rate locked at acceptance is a ceiling. A waiver granted since then
  -- lowers what is charged; a waiver that has lapsed does not raise it, because
  -- repricing an accepted schedule is what Fee Schedule section 8 forbids.
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

  -- The reason reported is the one belonging to the rate actually charged.
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

  -- No minimums. Round up to the next minor unit.
  buyer_service_fee_cents_value :=
    ceil(
      (base_amount_cents_value::numeric * buyer_fee_bps_value) / 10000
    )::integer;

  creator_platform_fee_cents_value :=
    ceil(
      (base_amount_cents_value::numeric * creator_fee_bps_value) / 10000
    )::integer;

  application_fee_cents_value :=
    buyer_service_fee_cents_value
    + creator_platform_fee_cents_value;

  -- Tips and optional Made for Stream support begin at zero.
  -- The buyer service fee is added to what the buyer pays.
  total_checkout_cents_value :=
    base_amount_cents_value
    + buyer_service_fee_cents_value;

  -- With direct charges the application fee must be smaller than the full
  -- Checkout amount. With no minimums and a floor on the instalment this cannot
  -- fail, but it is the constraint Stripe actually enforces, so it stays as a
  -- backstop against a future rate change that forgets it.
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

  -- A concurrent trigger may have inserted the row first.
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

revoke all
on function
public.ensure_listing_request_payment_for_schedule_item(uuid)
from public;
