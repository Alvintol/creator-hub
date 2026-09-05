-- Link the existing agreement payment schedule to the Stripe payment ledger.
-- The schedule remains the workflow source of truth while
-- listing_request_payments owns the actual Stripe transaction.

alter table public.listing_request_payments
add column if not exists payment_schedule_item_id uuid null;

alter table public.listing_request_payments
drop constraint if exists listing_request_payments_payment_schedule_item_fkey;

alter table public.listing_request_payments
add constraint listing_request_payments_payment_schedule_item_fkey
foreign key (payment_schedule_item_id)
references public.listing_request_payment_schedule_items(id)
on delete set null;

create unique index if not exists
listing_request_payments_payment_schedule_item_idx
on public.listing_request_payments(payment_schedule_item_id)
where payment_schedule_item_id is not null;


-- Create exactly one Stripe payment ledger row for a payment schedule item
-- once that item is actually payable.
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
  schedule_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  existing_payment_id uuid;
  new_payment_id uuid;

  payment_type_value text;

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

  -- Buyer service fee:
  -- 5% of the base payment with a $1.00 minimum.
  buyer_service_fee_cents_value :=
    greatest(
      ceil(
        (
          base_amount_cents_value::numeric * 500
        ) / 10000
      )::integer,
      100
    );

  -- Creator platform fee:
  -- 5% of the base payment with a $1.50 minimum.
  creator_platform_fee_cents_value :=
    greatest(
      ceil(
        (
          base_amount_cents_value::numeric * 500
        ) / 10000
      )::integer,
      150
    );

  application_fee_cents_value :=
    buyer_service_fee_cents_value
    + creator_platform_fee_cents_value;

  -- Tips and optional CreatorHub support begin at zero.
  -- The buyer service fee is added to what the buyer pays.
  total_checkout_cents_value :=
    base_amount_cents_value
    + buyer_service_fee_cents_value;

  -- With direct charges the application fee must be smaller
  -- than the full Checkout amount.
  if application_fee_cents_value >= total_checkout_cents_value then
    raise exception
      'Payment amount % % is too small for the configured CreatorHub fee minimums.',
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

    500,
    500,

    100,
    150,

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


-- Schedule items can become payable later:
-- milestone approval, change-order acceptance, final balance, etc.
create or replace function
public.create_listing_request_payment_when_schedule_item_required()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'payment_required'
  and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
  ) then
    perform
      public.ensure_listing_request_payment_for_schedule_item(
        new.id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists
listing_request_payment_schedule_items_create_stripe_payment
on public.listing_request_payment_schedule_items;

create trigger
listing_request_payment_schedule_items_create_stripe_payment
after insert or update of status
on public.listing_request_payment_schedule_items
for each row
execute function
public.create_listing_request_payment_when_schedule_item_required();


-- Starting-payment schedule items may already be payment_required
-- while the agreement is still sent. When the buyer accepts, create
-- any Stripe ledger rows that are now eligible.
create or replace function
public.create_listing_request_payments_when_agreement_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_schedule_item_id_value uuid;
begin
  if new.status = 'buyer_accepted'
  and old.status is distinct from new.status then
    for payment_schedule_item_id_value in
      select listing_request_payment_schedule_items.id
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id =
        new.id
      and listing_request_payment_schedule_items.status =
        'payment_required'
    loop
      perform
        public.ensure_listing_request_payment_for_schedule_item(
          payment_schedule_item_id_value
        );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists
listing_request_agreements_create_stripe_payments
on public.listing_request_agreements;

create trigger
listing_request_agreements_create_stripe_payments
after update of status
on public.listing_request_agreements
for each row
execute function
public.create_listing_request_payments_when_agreement_accepted();


-- Keep these internal helpers unavailable as public RPCs.
revoke all
on function
public.ensure_listing_request_payment_for_schedule_item(uuid)
from public;

revoke all
on function
public.create_listing_request_payment_when_schedule_item_required()
from public;

revoke all
on function
public.create_listing_request_payments_when_agreement_accepted()
from public;


-- Backfill any already-accepted agreements that currently have
-- payment-required schedule items.
do $$
declare
  payment_schedule_item_id_value uuid;
begin
  for payment_schedule_item_id_value in
    select payment_schedule_items.id
    from public.listing_request_payment_schedule_items
      as payment_schedule_items
    join public.listing_request_agreements
      as agreements
      on agreements.id =
        payment_schedule_items.agreement_id
    where payment_schedule_items.status =
      'payment_required'
    and agreements.status =
      'buyer_accepted'
  loop
    perform
      public.ensure_listing_request_payment_for_schedule_item(
        payment_schedule_item_id_value
      );
  end loop;
end;
$$;