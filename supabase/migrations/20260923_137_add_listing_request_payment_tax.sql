-- Sprint 7 (launch-scope.md section 12): regional sales tax -- the ledger,
-- location evidence and refund plumbing. Collection itself stays OFF until
-- the professional-advice gate in section 12.3 is cleared: the API only
-- calculates tax for countries listed in STRIPE_TAX_COLLECTION_COUNTRIES,
-- which ships empty (docs/support/payments/tax.md). Everything below is
-- jurisdiction-neutral -- nothing here assumes where Made for Stream is
-- registered, or whether the buyer service fee / platform contribution are
-- separately taxable (both are per-line tax codes set by config, not
-- constants in this schema).
--
-- Charge model: commission payments stay direct charges on the creator's
-- connected account (launch-scope.md section 3.4, Model A). Stripe Tax does
-- not support platform tax liability on direct charges, so tax is
-- calculated with the Stripe Tax Calculation API on the platform's own
-- account, charged as its own Checkout line, and swept to the platform
-- inside application_fee_cents -- the same mechanism the buyer fee,
-- contribution and recovery instalment already use. That is why tax_cents
-- is added to BOTH the total and the application-fee constraints below.
--
-- Tax is stored per line (base, buyer fee, tip, contribution) rather than
-- as one figure, because refunds reverse those lines on different bases:
-- the base and buyer-fee lines follow the cumulative base refunded (section
-- 6.2), while tips and contributions are refunded explicitly (Refund Policy
-- section 8) -- so their tax has to follow their own refunded amounts.

-- 1. Tax on the payment ledger ---------------------------------------------

alter table public.listing_request_payments
  add column if not exists tax_on_base_cents integer not null default 0
    check (tax_on_base_cents >= 0),
  add column if not exists tax_on_buyer_fee_cents integer not null default 0
    check (tax_on_buyer_fee_cents >= 0),
  add column if not exists tax_on_tip_cents integer not null default 0
    check (tax_on_tip_cents >= 0),
  add column if not exists tax_on_support_cents integer not null default 0
    check (tax_on_support_cents >= 0),
  add column if not exists tax_cents integer not null default 0
    check (tax_cents >= 0),
  -- null until the checkout route has determined tax for this payment.
  -- 'not_collected': the buyer's country is not one we collect in (the
  --   default for every country while the advice gate is open).
  -- 'calculated': Stripe Tax calculated this payment's tax (which may still
  --   be zero, e.g. a zero-rated line).
  add column if not exists tax_treatment text null
    check (tax_treatment is null or tax_treatment in ('not_collected', 'calculated')),
  add column if not exists tax_jurisdiction_country text null
    check (tax_jurisdiction_country is null or tax_jurisdiction_country ~ '^[A-Z]{2}$'),
  add column if not exists tax_jurisdiction_region text null
    check (tax_jurisdiction_region is null or char_length(tax_jurisdiction_region) between 1 and 10),
  add column if not exists stripe_tax_calculation_id text null,
  add column if not exists stripe_tax_transaction_id text null,
  add column if not exists tax_calculated_at timestamptz null;

alter table public.listing_request_payments
  drop constraint if exists listing_request_payments_tax_lines_check;

alter table public.listing_request_payments
  add constraint listing_request_payments_tax_lines_check
  check (
    tax_cents =
      tax_on_base_cents
      + tax_on_buyer_fee_cents
      + tax_on_tip_cents
      + tax_on_support_cents
  );

alter table public.listing_request_payments
  drop constraint if exists listing_request_payments_tax_treatment_check;

-- A payment with tax on it must say where and from which calculation; a
-- payment we did not collect on carries no tax at all.
alter table public.listing_request_payments
  add constraint listing_request_payments_tax_treatment_check
  check (
    (tax_treatment is null and tax_cents = 0 and stripe_tax_calculation_id is null)
    or (tax_treatment = 'not_collected' and tax_cents = 0
        and stripe_tax_calculation_id is null and tax_jurisdiction_country is not null)
    or (tax_treatment = 'calculated' and stripe_tax_calculation_id is not null
        and tax_jurisdiction_country is not null)
  );

-- Tax is part of what the buyer pays. The original total check was an
-- unnamed table constraint in 20260624_108 (Postgres named it by position),
-- so find it by definition rather than trusting a generated name.
do $$
declare
  constraint_name_value text;
begin
  for constraint_name_value in
    select conname
    from pg_constraint
    where conrelid = 'public.listing_request_payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like 'CHECK ((total_checkout_cents = %'
  loop
    execute format(
      'alter table public.listing_request_payments drop constraint %I',
      constraint_name_value
    );
  end loop;
end;
$$;

alter table public.listing_request_payments
  add constraint listing_request_payments_total_checkout_check
  check (
    total_checkout_cents =
      base_amount_cents
      + creator_tip_cents
      + buyer_service_fee_cents
      + platform_support_cents
      + tax_cents
  );

-- Tax reaches the platform through the application fee (Model A, see the
-- header), exactly like the contribution. Replaces 20260922_129's version.
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
      + tax_cents
  );

-- 2. Buyer location evidence -----------------------------------------------
--
-- EU VAT on electronically supplied services needs two non-contradictory
-- pieces of evidence of where the buyer is (Implementing Regulation
-- 282/2011 art. 24b/24f). Only the country is stored -- never the IP
-- address or card number itself.
--
-- evidence_type -> category. Two rows in the same category are ONE piece of
-- evidence, not two: a billing country the buyer declared before checkout
-- and the billing address Stripe Checkout collected are both "billing
-- address", so they can never satisfy the rule on their own.
create table if not exists public.listing_request_payment_tax_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.listing_request_payments(id) on delete cascade,

  evidence_type text not null check (
    evidence_type in (
      'billing_address_declared',  -- buyer-selected, before checkout
      'billing_address_checkout',  -- collected by Stripe Checkout, after payment
      'ip_address',                -- geolocated from the checkout request, before checkout
      'card_issuer'                -- the paying card's issuing country, after payment
    )
  ),
  evidence_category text generated always as (
    case
      when evidence_type in ('billing_address_declared', 'billing_address_checkout')
        then 'billing_address'
      else evidence_type
    end
  ) stored,

  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  source text not null check (char_length(btrim(source)) between 1 and 200),

  captured_at timestamptz not null default now(),

  unique (payment_id, evidence_type)
);

create index if not exists listing_request_payment_tax_evidence_payment_idx
  on public.listing_request_payment_tax_evidence(payment_id);

alter table public.listing_request_payment_tax_evidence enable row level security;

drop policy if exists "listing request payment tax evidence payer or admin read"
  on public.listing_request_payment_tax_evidence;

-- The buyer can see what was recorded about their own location; the
-- creator cannot -- it is the buyer's personal data and the creator has no
-- need for it.
create policy "listing request payment tax evidence payer or admin read"
  on public.listing_request_payment_tax_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listing_request_payments
      where listing_request_payments.id = listing_request_payment_tax_evidence.payment_id
        and (
          listing_request_payments.payer_user_id = auth.uid()
          or public.is_admin_user(auth.uid())
        )
    )
  );

-- No client write policy: every write goes through the function below.

-- Pre-payment evidence may be replaced while the buyer is still in
-- checkout (they changed their billing country); post-payment evidence is
-- written once the charge exists and is never overwritten by pre-payment
-- evidence after the fact.
create or replace function public.record_listing_request_payment_tax_evidence(
  p_payment_id uuid,
  p_evidence_type text,
  p_country_code text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_status text;
  country_value text := upper(btrim(coalesce(p_country_code, '')));
begin
  if country_value !~ '^[A-Z]{2}$' then
    raise exception 'Evidence country must be a two-letter ISO country code.'
      using errcode = '22023';
  end if;

  select status
  into payment_status
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0001';
  end if;

  -- The same statuses api/server.js lets checkout (re)open from
  -- (CHECKOUT_OPENABLE_PAYMENT_STATUSES): a failed or expired checkout is
  -- still unpaid, and retrying it re-declares the billing country.
  if p_evidence_type in ('billing_address_declared', 'ip_address')
    and payment_status not in ('requires_checkout', 'checkout_opened', 'failed', 'cancelled')
  then
    raise exception
      'Pre-payment location evidence cannot change after checkout has completed.'
      using errcode = 'P0001';
  end if;

  if p_evidence_type in ('billing_address_checkout', 'card_issuer')
    and payment_status not in ('processing', 'paid', 'partially_refunded', 'refunded', 'disputed')
  then
    raise exception
      'Post-payment location evidence can only be recorded once the payment exists.'
      using errcode = 'P0001';
  end if;

  insert into public.listing_request_payment_tax_evidence (
    payment_id, evidence_type, country_code, source, captured_at
  )
  values (
    p_payment_id, p_evidence_type, country_value, btrim(p_source), now()
  )
  on conflict (payment_id, evidence_type) do update
  set
    country_code = excluded.country_code,
    source = excluded.source,
    captured_at = excluded.captured_at;
end;
$$;

revoke all on function public.record_listing_request_payment_tax_evidence(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.record_listing_request_payment_tax_evidence(uuid, text, text, text)
  to service_role;

-- The one place "is the location evidence good enough" is decided. Mirrored
-- for display/testing by classifyTaxLocationEvidence in
-- src/domain/payments/listingRequestPaymentTax.ts.
--
--   sufficient:    at least two distinct evidence CATEGORIES agree on the
--                  country tax was determined for.
--   contradictory: at least two distinct categories agree on some OTHER
--                  country -- the tax may have been charged for the wrong
--                  place (TAX-002 in docs/support/payments/tax.md).
--   insufficient:  neither -- typically only one category is present yet
--                  (before payment, with no IP country available).
create or replace function public.get_listing_request_payment_tax_evidence_status(
  p_payment_id uuid
)
returns table (
  evidence_status text,
  taxed_country text,
  agreeing_categories integer,
  conflicting_country text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_country text;
  agreeing integer;
  conflict_country text;
begin
  select coalesce(
    listing_request_payments.tax_jurisdiction_country,
    (
      select country_code
      from public.listing_request_payment_tax_evidence
      where listing_request_payment_tax_evidence.payment_id = p_payment_id
        and evidence_type = 'billing_address_declared'
    )
  )
  into target_country
  from public.listing_request_payments
  where listing_request_payments.id = p_payment_id;

  select count(distinct evidence_category)::integer
  into agreeing
  from public.listing_request_payment_tax_evidence
  where listing_request_payment_tax_evidence.payment_id = p_payment_id
    and country_code = target_country;

  select country_code
  into conflict_country
  from public.listing_request_payment_tax_evidence
  where listing_request_payment_tax_evidence.payment_id = p_payment_id
    and country_code is distinct from target_country
  group by country_code
  having count(distinct evidence_category) >= 2
  order by count(distinct evidence_category) desc, country_code
  limit 1;

  return query
  select
    case
      when conflict_country is not null then 'contradictory'
      when coalesce(agreeing, 0) >= 2 then 'sufficient'
      else 'insufficient'
    end,
    target_country,
    coalesce(agreeing, 0),
    conflict_country;
end;
$$;

revoke all on function public.get_listing_request_payment_tax_evidence_status(uuid)
  from public, anon, authenticated;

grant execute on function public.get_listing_request_payment_tax_evidence_status(uuid)
  to service_role;

-- 3. Writing tax onto a payment --------------------------------------------
--
-- Service-role only: called by POST /api/stripe/checkout/session after
-- recompute_listing_request_payment_amounts, with the per-line tax Stripe
-- Tax returned (or zeros and 'not_collected'). Never trusts the caller for
-- the totals -- it recomputes total_checkout_cents and application_fee_cents
-- from the stored components plus the tax lines, so the row's own check
-- constraints are what guarantee the charged total includes the tax.
--
-- Recalculating identical tax (a page refresh) only refreshes the
-- calculation id and timestamp; it does not bump updated_at, so the
-- still-open Checkout Session stays reusable. Any change to the tax lines or
-- jurisdiction resets checkout_opened -> requires_checkout and clears the
-- session id, the same way recompute_listing_request_payment_amounts does
-- for drift, so a session built on the old total is never reused.
create or replace function public.set_listing_request_payment_tax(
  p_payment_id uuid,
  p_tax_treatment text,
  p_jurisdiction_country text,
  p_jurisdiction_region text,
  p_tax_on_base_cents integer,
  p_tax_on_buyer_fee_cents integer,
  p_tax_on_tip_cents integer,
  p_tax_on_support_cents integer,
  p_stripe_tax_calculation_id text
)
returns public.listing_request_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.listing_request_payments%rowtype;

  country_value text := upper(btrim(coalesce(p_jurisdiction_country, '')));
  region_value text := nullif(upper(btrim(coalesce(p_jurisdiction_region, ''))), '');

  tax_on_base integer := coalesce(p_tax_on_base_cents, 0);
  tax_on_buyer_fee integer := coalesce(p_tax_on_buyer_fee_cents, 0);
  tax_on_tip integer := coalesce(p_tax_on_tip_cents, 0);
  tax_on_support integer := coalesce(p_tax_on_support_cents, 0);
  tax_total integer;

  new_application_fee_cents integer;
  new_total_checkout_cents integer;

  tax_changed boolean;
begin
  if p_tax_treatment not in ('not_collected', 'calculated') then
    raise exception 'Unknown tax treatment: %.', p_tax_treatment
      using errcode = '22023';
  end if;

  if country_value !~ '^[A-Z]{2}$' then
    raise exception 'Tax jurisdiction must be a two-letter ISO country code.'
      using errcode = '22023';
  end if;

  if tax_on_base < 0 or tax_on_buyer_fee < 0 or tax_on_tip < 0 or tax_on_support < 0 then
    raise exception 'Tax amounts must be zero or greater.'
      using errcode = '22023';
  end if;

  tax_total := tax_on_base + tax_on_buyer_fee + tax_on_tip + tax_on_support;

  if p_tax_treatment = 'not_collected'
    and (tax_total <> 0 or p_stripe_tax_calculation_id is not null)
  then
    raise exception 'A payment we do not collect tax on cannot carry tax.'
      using errcode = '22023';
  end if;

  if p_tax_treatment = 'calculated'
    and nullif(btrim(coalesce(p_stripe_tax_calculation_id, '')), '') is null
  then
    raise exception 'Calculated tax must reference its Stripe Tax calculation.'
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

  -- Mirrors CHECKOUT_OPENABLE_PAYMENT_STATUSES in api/server.js: a failed
  -- or expired checkout can be retried, and gets its tax re-determined.
  if payment_row.status not in ('requires_checkout', 'checkout_opened', 'failed', 'cancelled') then
    raise exception
      'Tax can only be set before checkout is completed.'
      using errcode = 'P0001';
  end if;

  -- The jurisdiction tax is determined for must be backed by the buyer's
  -- own recorded billing country -- never a country the server picked with
  -- no evidence behind it.
  if not exists (
    select 1
    from public.listing_request_payment_tax_evidence
    where listing_request_payment_tax_evidence.payment_id = p_payment_id
      and evidence_type = 'billing_address_declared'
      and country_code = country_value
  ) then
    raise exception
      'Tax jurisdiction % does not match the buyer''s recorded billing country.',
      country_value
      using errcode = 'P0001';
  end if;

  if (tax_on_tip > 0 and payment_row.creator_tip_cents = 0)
    or (tax_on_support > 0 and payment_row.platform_support_cents = 0)
    or (tax_on_buyer_fee > 0 and payment_row.buyer_service_fee_cents = 0)
  then
    raise exception 'Tax cannot apply to a line that is zero on this payment.'
      using errcode = '22023';
  end if;

  new_application_fee_cents :=
    payment_row.buyer_service_fee_cents
    + payment_row.creator_platform_fee_cents
    + payment_row.platform_support_cents
    + payment_row.recovery_instalment_cents
    + tax_total;

  new_total_checkout_cents :=
    payment_row.base_amount_cents
    + payment_row.creator_tip_cents
    + payment_row.buyer_service_fee_cents
    + payment_row.platform_support_cents
    + tax_total;

  if new_application_fee_cents >= new_total_checkout_cents then
    raise exception
      'This payment amount is too small for the configured Made for Stream fees.'
      using errcode = 'P0001';
  end if;

  tax_changed :=
    payment_row.tax_treatment is distinct from p_tax_treatment
    or payment_row.tax_jurisdiction_country is distinct from country_value
    or payment_row.tax_jurisdiction_region is distinct from region_value
    or payment_row.tax_on_base_cents <> tax_on_base
    or payment_row.tax_on_buyer_fee_cents <> tax_on_buyer_fee
    or payment_row.tax_on_tip_cents <> tax_on_tip
    or payment_row.tax_on_support_cents <> tax_on_support;

  if not tax_changed then
    update public.listing_request_payments
    set
      stripe_tax_calculation_id = nullif(btrim(coalesce(p_stripe_tax_calculation_id, '')), ''),
      tax_calculated_at = now()
    where listing_request_payments.id = payment_row.id
    returning * into payment_row;

    return payment_row;
  end if;

  update public.listing_request_payments
  set
    tax_treatment = p_tax_treatment,
    tax_jurisdiction_country = country_value,
    tax_jurisdiction_region = region_value,
    tax_on_base_cents = tax_on_base,
    tax_on_buyer_fee_cents = tax_on_buyer_fee,
    tax_on_tip_cents = tax_on_tip,
    tax_on_support_cents = tax_on_support,
    tax_cents = tax_total,
    stripe_tax_calculation_id = nullif(btrim(coalesce(p_stripe_tax_calculation_id, '')), ''),
    tax_calculated_at = now(),

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

revoke all on function public.set_listing_request_payment_tax(
  uuid, text, text, text, integer, integer, integer, integer, text
) from public, anon, authenticated;

grant execute on function public.set_listing_request_payment_tax(
  uuid, text, text, text, integer, integer, integer, integer, text
) to service_role;

-- Records the Stripe Tax transaction created from the calculation once the
-- payment is paid -- what makes the tax appear in Stripe Tax's filing
-- exports. Idempotent: only fills the id once.
create or replace function public.set_listing_request_payment_tax_transaction(
  p_payment_id uuid,
  p_stripe_tax_transaction_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(p_stripe_tax_transaction_id, '')), '') is null then
    raise exception 'A Stripe Tax transaction id is required.'
      using errcode = '22023';
  end if;

  update public.listing_request_payments
  set stripe_tax_transaction_id = btrim(p_stripe_tax_transaction_id)
  where listing_request_payments.id = p_payment_id
    and listing_request_payments.tax_treatment = 'calculated'
    and listing_request_payments.stripe_tax_transaction_id is null;
end;
$$;

revoke all on function public.set_listing_request_payment_tax_transaction(uuid, text)
  from public, anon, authenticated;

grant execute on function public.set_listing_request_payment_tax_transaction(uuid, text)
  to service_role;

-- 4. Creator tax status ----------------------------------------------------
--
-- Stored from the Stripe Connect v2 account's identity at onboarding and
-- every status refresh (api/server.js upsertCreatorPaymentAccount).
-- creator_payment_accounts.country already holds the creator's country.
-- tax_id_types records which kinds of tax id Stripe collected (e.g. a VAT
-- number), never the number itself. Whether that makes the creator
-- "registered" for a given regime -- and so whether EU reverse charge
-- applies to a supply involving them -- is part of the advice gate and is
-- deliberately NOT derived here.
alter table public.creator_payment_accounts
  add column if not exists tax_entity_type text null
    check (tax_entity_type is null or char_length(tax_entity_type) between 1 and 50),
  add column if not exists tax_id_types text[] not null default '{}';

-- 5. Recompute clears stale tax --------------------------------------------
--
-- Re-created from 20260922_129 (Postgres cannot patch one statement into a
-- function body). Two changes only: the drift comparison is net of stored
-- tax, and a genuine amount change clears the now-stale tax. Everything
-- else is reproduced unchanged.
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
    -- Compared net of any stored tax: tax is layered on top by
    -- set_listing_request_payment_tax, and is not something this
    -- function derives, so its presence alone is not drift.
    or payment_row.application_fee_cents - payment_row.tax_cents
      <> application_fee_cents_value
    or payment_row.total_checkout_cents - payment_row.tax_cents
      <> total_checkout_cents_value;

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

    -- Sprint 7: the stored tax was calculated on the old amounts, so it is
    -- stale -- clear it. The checkout route recalculates it (and
    -- set_listing_request_payment_tax re-adds it to both totals) before
    -- the next Stripe session is created.
    tax_on_base_cents = 0,
    tax_on_buyer_fee_cents = 0,
    tax_on_tip_cents = 0,
    tax_on_support_cents = 0,
    tax_cents = 0,
    tax_treatment = null,
    tax_jurisdiction_country = null,
    tax_jurisdiction_region = null,
    stripe_tax_calculation_id = null,
    tax_calculated_at = null,

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

-- 6. Tip/contribution changes clear stale tax ------------------------------
--
-- Re-created from 20260922_126. A changed tip or contribution changes what
-- tax is charged on, so any stored tax is cleared here in the same
-- statement (keeping both total constraints true at commit) and
-- recalculated by the checkout route before the next session.
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

  -- Unchanged from 20260922_126, plus the recovery instalment term
  -- 20260922_129 added to the application-fee constraint (126 predates it).
  -- Tax is deliberately absent: it is cleared below.
  new_application_fee_cents :=
    payment_row.buyer_service_fee_cents
    + payment_row.creator_platform_fee_cents
    + p_platform_support_cents
    + payment_row.recovery_instalment_cents;

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

    tax_on_base_cents = 0,
    tax_on_buyer_fee_cents = 0,
    tax_on_tip_cents = 0,
    tax_on_support_cents = 0,
    tax_cents = 0,
    tax_treatment = null,
    tax_jurisdiction_country = null,
    tax_jurisdiction_region = null,
    stripe_tax_calculation_id = null,
    tax_calculated_at = null,

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

-- 7. Tax on the refund ledger ----------------------------------------------
--
-- Computed by apply_refunded_listing_request_payment, never written by a
-- client -- same as the fee columns 20260922_125 added. Mirrored exactly by
-- computeCumulativeRefund (api/refundArithmetic.js), which decides the
-- amount actually sent to Stripe, and by
-- computeCumulativeListingRequestPaymentRefund
-- (src/domain/payments/listingRequestPaymentRefunds.ts) for display.
alter table public.listing_request_payment_refunds
  add column if not exists base_tax_refund_cents integer not null default 0
    check (base_tax_refund_cents >= 0),
  add column if not exists buyer_fee_tax_refund_cents integer not null default 0
    check (buyer_fee_tax_refund_cents >= 0),
  add column if not exists tip_tax_refund_cents integer not null default 0
    check (tip_tax_refund_cents >= 0),
  add column if not exists support_tax_refund_cents integer not null default 0
    check (support_tax_refund_cents >= 0),
  add column if not exists stripe_tax_reversal_id text null;

alter table public.listing_request_payment_refunds
  add column if not exists tax_refund_cents integer
    generated always as (
      base_tax_refund_cents
      + buyer_fee_tax_refund_cents
      + tip_tax_refund_cents
      + support_tax_refund_cents
    ) stored;

-- Filled after the fact by the refund route once the Stripe Tax reversal
-- exists (it is created after the ledger row, from the ledger row's own
-- tax figures). Only ever fills a null.
create or replace function public.set_listing_request_payment_refund_tax_reversal(
  p_refund_id uuid,
  p_stripe_tax_reversal_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listing_request_payment_refunds
  set stripe_tax_reversal_id = btrim(p_stripe_tax_reversal_id)
  where listing_request_payment_refunds.id = p_refund_id
    and listing_request_payment_refunds.stripe_tax_reversal_id is null
    and nullif(btrim(coalesce(p_stripe_tax_reversal_id, '')), '') is not null;
end;
$$;

revoke all on function public.set_listing_request_payment_refund_tax_reversal(uuid, text)
  from public, anon, authenticated;

grant execute on function public.set_listing_request_payment_refund_tax_reversal(uuid, text)
  to service_role;

-- 8. The refund engine, with proportional tax ------------------------------
--
-- Re-created from 20260922_136 (itself 20260922_125 plus the closure-refund
-- loop). The only additions are the tax sums, the tax block right before
-- this_buyer_fee_refund is computed, and the four tax columns in the
-- insert. The return type is deliberately unchanged, so no caller breaks;
-- the refund route reads the ledger row for the tax actually recorded.
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

  already_base_tax_refunded integer;
  already_buyer_fee_tax_refunded integer;
  already_tip_tax_refunded integer;
  already_support_tax_refunded integer;

  cumulative_tip integer;
  cumulative_contribution integer;

  base_tax_cumulative integer;
  buyer_fee_tax_cumulative integer;
  tip_tax_cumulative integer;
  support_tax_cumulative integer;

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
         coalesce(sum(contribution_refund_cents), 0),
         coalesce(sum(base_tax_refund_cents), 0),
         coalesce(sum(buyer_fee_tax_refund_cents), 0),
         coalesce(sum(tip_tax_refund_cents), 0),
         coalesce(sum(support_tax_refund_cents), 0)
  into already_base_refunded,
       already_buyer_fee_refunded,
       already_creator_fee_reversed,
       already_tip_refunded,
       already_contribution_refunded,
       already_base_tax_refunded,
       already_buyer_fee_tax_refunded,
       already_tip_tax_refunded,
       already_support_tax_refunded
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

  -- Sprint 7 (Refund Policy section 8): tax follows the line it was
  -- charged on, with the same cumulative rounding as the fees above -- one
  -- rounding against the original tax, and the exact remainder once a line
  -- is fully refunded. Base and buyer-fee tax follow the cumulative base;
  -- tip and contribution tax follow the cumulative tip / contribution
  -- refunded, since those are refunded explicitly rather than prorated.
  if cumulative_base >= payment_row.base_amount_cents then
    base_tax_cumulative := payment_row.tax_on_base_cents;
    buyer_fee_tax_cumulative := payment_row.tax_on_buyer_fee_cents;
  else
    base_tax_cumulative := round(
      payment_row.tax_on_base_cents::numeric * cumulative_base
      / payment_row.base_amount_cents
    )::integer;

    buyer_fee_tax_cumulative := round(
      payment_row.tax_on_buyer_fee_cents::numeric * cumulative_base
      / payment_row.base_amount_cents
    )::integer;
  end if;

  cumulative_tip := already_tip_refunded + coalesce(p_tip_refund_cents, 0);
  cumulative_contribution :=
    already_contribution_refunded + coalesce(p_contribution_refund_cents, 0);

  tip_tax_cumulative := case
    when payment_row.creator_tip_cents = 0 then 0
    when cumulative_tip >= payment_row.creator_tip_cents then payment_row.tax_on_tip_cents
    else round(
      payment_row.tax_on_tip_cents::numeric * cumulative_tip
      / payment_row.creator_tip_cents
    )::integer
  end;

  support_tax_cumulative := case
    when payment_row.platform_support_cents = 0 then 0
    when cumulative_contribution >= payment_row.platform_support_cents
      then payment_row.tax_on_support_cents
    else round(
      payment_row.tax_on_support_cents::numeric * cumulative_contribution
      / payment_row.platform_support_cents
    )::integer
  end;

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
    base_tax_refund_cents,
    buyer_fee_tax_refund_cents,
    tip_tax_refund_cents,
    support_tax_refund_cents,
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
    greatest(base_tax_cumulative - already_base_tax_refunded, 0),
    greatest(buyer_fee_tax_cumulative - already_buyer_fee_tax_refunded, 0),
    greatest(tip_tax_cumulative - already_tip_tax_refunded, 0),
    greatest(support_tax_cumulative - already_support_tax_refunded, 0),
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
