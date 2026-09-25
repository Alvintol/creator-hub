-- Sprint 8 (launch-implementation-checklist.md): the launch gates that live in
-- the database rather than in policy text.
--
-- 1. supported_currencies -- the currencies a project may be priced in, and
--    the per-currency instalment floor. A deliberately small first cut of the
--    Sprint 1 registry (launch-scope.md section 1.1): every row is a
--    two-decimal currency, because the payment bridge still converts with
--    `* 100` (ensure_listing_request_payment_for_schedule_item). Zero- and
--    three-decimal currencies (JPY, KWD, ...) are refused by a check
--    constraint until that exponent work is done, so enabling one is a
--    migration, not a data edit. Before this, any three-letter code was
--    accepted everywhere.
--
--    Enabled: CAD and USD (wave 1) and the two-decimal majors of wave 2
--    (section 1.3). Decided 2026-09-23. Being accepted here is NOT the same
--    as being cleared for live sales: EU/UK VAT applies from the first sale,
--    and the Sprint 7 tax-advice gate is still open (docs/support/payments/tax.md).
--
-- 2. The instalment floor -- 10.00 in every enabled currency (decided
--    2026-09-23, replacing section 3.1's 5.00). Checked when a schedule item is
--    created or its amount changes, when an agreement is sent, and when a
--    change order carrying a price increase is sent -- each with a message
--    that says what to do. The older 5.00 check inside the payment bridge is
--    left untouched as a backstop, so schedules accepted before this migration
--    keep the terms they were accepted under (Fee Schedule section 8).
--
-- 3. Express request to start work early (launch-scope.md section 1.5) --
--    now required at agreement acceptance. respond_listing_request_agreement
--    takes the early-start version, records it in policy_acceptances in the
--    same transaction, and refuses acceptance without it. The old
--    three-argument signature is dropped so a direct RPC call cannot skip it,
--    and a trigger refuses any other route to buyer_accepted without the row.
--
-- Written, not applied, and not executed against a Postgres instance (none
-- was available locally) -- the same hand-over as Sprints 3-7.

-- 1. Supported currencies ---------------------------------------------------

create table if not exists public.supported_currencies (
  code text primary key check (code ~ '^[a-z]{3}$'),

  -- Only 2 until the bridge stops converting with `* 100`.
  minor_unit_exponent smallint not null default 2
    check (minor_unit_exponent = 2),

  minimum_instalment_minor_units integer not null
    check (minimum_instalment_minor_units > 0),

  enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.supported_currencies is
  'Currencies a project may be priced in, with the per-currency instalment floor. Two-decimal only until the payment bridge reads the exponent (launch-scope.md section 1.1).';

alter table public.supported_currencies enable row level security;

drop policy if exists "supported currencies are public"
  on public.supported_currencies;

create policy "supported currencies are public"
on public.supported_currencies
for select
to anon, authenticated
using (true);

-- Mirrored in src/domain/payments/supportedCurrencies.ts and
-- api/supportedCurrencies.js; supportedCurrenciesSync.test.ts keeps the two
-- code copies aligned, and this seed must be changed alongside them.
insert into public.supported_currencies (
  code,
  minimum_instalment_minor_units,
  enabled
)
values
  ('cad', 1000, true),
  ('usd', 1000, true),
  ('eur', 1000, true),
  ('gbp', 1000, true),
  ('aud', 1000, true),
  ('nzd', 1000, true),
  ('chf', 1000, true),
  ('sgd', 1000, true),
  ('sek', 1000, true),
  ('nok', 1000, true),
  ('dkk', 1000, true),
  ('pln', 1000, true),
  ('mxn', 1000, true),
  ('brl', 1000, true),
  ('hkd', 1000, true)
on conflict (code) do nothing;

-- 2. The instalment floor ---------------------------------------------------

-- One place for the currency and floor rules, so every caller raises the
-- same plain-language message (docs/support/payments/agreements.md, AGR-006).
create or replace function public.assert_listing_request_instalment_allowed(
  p_amount numeric,
  p_currency text
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  currency_row public.supported_currencies%rowtype;
  amount_minor_units numeric;
begin
  select *
  into currency_row
  from public.supported_currencies
  where supported_currencies.code = lower(coalesce(p_currency, ''))
    and supported_currencies.enabled;

  if not found then
    raise exception
      'Payments in % are not supported yet. Price the project in a currency listed in the Fee Schedule.',
      upper(coalesce(p_currency, '(none)'))
      using errcode = 'P0001';
  end if;

  amount_minor_units :=
    round(coalesce(p_amount, 0) * power(10, currency_row.minor_unit_exponent));

  if amount_minor_units < currency_row.minimum_instalment_minor_units then
    raise exception
      'Each payment in a project must be at least % %, and this one is % %. Combine it with another payment or raise its amount.',
      to_char(
        currency_row.minimum_instalment_minor_units
          / power(10, currency_row.minor_unit_exponent),
        'FM999999990.00'
      ),
      upper(currency_row.code),
      to_char(coalesce(p_amount, 0), 'FM999999990.00'),
      upper(currency_row.code)
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all
on function public.assert_listing_request_instalment_allowed(numeric, text)
from public, anon, authenticated;

-- Schedule items: every insert, and any change to amount or currency.
-- Waived and cancelled items are never charged, so they are not held to the
-- floor. Status-only updates (paid, cancelled, ...) never fire this, so
-- legacy rows below the new floor can still be settled.
create or replace function public.enforce_listing_request_schedule_item_instalment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('waived', 'cancelled') then
    return new;
  end if;

  perform public.assert_listing_request_instalment_allowed(
    new.amount,
    new.currency
  );

  return new;
end;
$$;

revoke all
on function public.enforce_listing_request_schedule_item_instalment()
from public, anon, authenticated;

drop trigger if exists listing_request_schedule_items_enforce_instalment
  on public.listing_request_payment_schedule_items;

create trigger listing_request_schedule_items_enforce_instalment
  before insert or update of amount, currency
  on public.listing_request_payment_schedule_items
  for each row
  execute function public.enforce_listing_request_schedule_item_instalment();

-- Agreements: the currency on insert or change, and every schedule item
-- again at the moment it is sent (draft -> sent). An agreement created
-- directly as 'sent' is covered by the schedule-item trigger, since its
-- items are inserted after the agreement row. The send-time re-check is what
-- catches a draft saved before this migration.
create or replace function public.enforce_listing_request_agreement_instalments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row record;
begin
  if tg_op = 'INSERT'
    or new.currency is distinct from old.currency
  then
    if not exists (
      select 1
      from public.supported_currencies
      where supported_currencies.code = lower(new.currency)
        and supported_currencies.enabled
    ) then
      raise exception
        'Payments in % are not supported yet. Price the project in a currency listed in the Fee Schedule.',
        upper(new.currency)
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.status = 'sent'
    and old.status is distinct from 'sent'
  then
    for item_row in
      select
        listing_request_payment_schedule_items.amount,
        listing_request_payment_schedule_items.currency
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id = new.id
        and listing_request_payment_schedule_items.status
          not in ('waived', 'cancelled')
    loop
      perform public.assert_listing_request_instalment_allowed(
        item_row.amount,
        item_row.currency
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke all
on function public.enforce_listing_request_agreement_instalments()
from public, anon, authenticated;

drop trigger if exists listing_request_agreements_enforce_instalments
  on public.listing_request_agreements;

create trigger listing_request_agreements_enforce_instalments
  before insert or update of currency, status
  on public.listing_request_agreements
  for each row
  execute function public.enforce_listing_request_agreement_instalments();

-- Change orders: a price increase becomes its own schedule item when the
-- buyer accepts (20260608_086). Checking only then would show the buyer the
-- error; checking when the creator sends it shows it to the person who can
-- fix it.
create or replace function public.enforce_listing_request_change_order_instalment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_currency text;
begin
  if new.status <> 'sent'
    or coalesce(new.price_delta, 0) <= 0
    or (tg_op = 'UPDATE' and old.status = 'sent'
      and new.price_delta is not distinct from old.price_delta)
  then
    return new;
  end if;

  select listing_request_agreements.currency
  into agreement_currency
  from public.listing_request_agreements
  where listing_request_agreements.id = new.agreement_id;

  perform public.assert_listing_request_instalment_allowed(
    new.price_delta,
    agreement_currency
  );

  return new;
end;
$$;

revoke all
on function public.enforce_listing_request_change_order_instalment()
from public, anon, authenticated;

drop trigger if exists listing_request_change_orders_enforce_instalment
  on public.listing_request_change_orders;

create trigger listing_request_change_orders_enforce_instalment
  before insert or update of status, price_delta
  on public.listing_request_change_orders
  for each row
  execute function public.enforce_listing_request_change_order_instalment();

-- 3. Express request to start work early at agreement acceptance -----------

-- Any route to buyer_accepted must find the buyer's early-start request for
-- this project. respond_listing_request_agreement below writes it in the
-- same transaction; this trigger is the backstop for any other path.
create or replace function public.enforce_listing_request_agreement_early_start_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'buyer_accepted'
    and old.status is distinct from 'buyer_accepted'
    and not exists (
      select 1
      from public.policy_acceptances
      where policy_acceptances.user_id = new.buyer_user_id
        and policy_acceptances.policy_type = 'early_service_request'
        and policy_acceptances.related_listing_request_id =
          new.listing_request_id
    )
  then
    raise exception
      'Confirm that you want the creator to start work before any cancellation period ends, then accept the agreement.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all
on function public.enforce_listing_request_agreement_early_start_request()
from public, anon, authenticated;

drop trigger if exists listing_request_agreements_require_early_start_request
  on public.listing_request_agreements;

create trigger listing_request_agreements_require_early_start_request
  before update of status
  on public.listing_request_agreements
  for each row
  execute function public.enforce_listing_request_agreement_early_start_request();

-- Re-created from 20260524_071 with one new, required argument. The old
-- signature is dropped rather than overloaded: leaving it would let a direct
-- call accept without the early-start request (the trigger above would then
-- refuse it, but with no way to supply the version). Nothing else changes.
drop function if exists public.respond_listing_request_agreement(
  uuid,
  text,
  text[]
);

create or replace function public.respond_listing_request_agreement(
  p_agreement_id uuid,
  p_response text,
  p_acknowledgement_keys text[] default '{}'::text[],
  p_early_service_request_version text default null
)
returns table (
  id uuid,
  status text,
  starting_payment_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
  missing_acknowledgement_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to respond to a project agreement.'
      using errcode = '42501';
  end if;

  if p_response not in ('buyer_accepted', 'buyer_declined') then
    raise exception 'Agreement response must be buyer_accepted or buyer_declined.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id
    and listing_request_agreements.buyer_user_id = auth.uid()
    and listing_request_agreements.status = 'sent'
  for update;

  if not found then
    raise exception 'This project agreement is not available for your response.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
      and listing_requests.buyer_user_id = auth.uid()
  ) then
    raise exception 'This request is not ready for agreement response.'
      using errcode = 'P0001';
  end if;

  if p_response = 'buyer_accepted' then
    -- The express request to start work before any EU/UK cancellation
    -- period ends (Refund Policy section 1, launch-scope.md section 1.5).
    -- It carries the Refund Policy's version; the checkout route re-checks
    -- it against the current version before any payment is taken.
    if p_early_service_request_version is null
      or p_early_service_request_version
        !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(-draft-[0-9]+)?$'
    then
      raise exception
        'Confirm that you want the creator to start work before any cancellation period ends, then accept the agreement.'
        using errcode = 'P0001';
    end if;

    insert into public.policy_acceptances (
      user_id,
      policy_type,
      policy_version,
      related_listing_request_id
    )
    values (
      auth.uid(),
      'early_service_request',
      p_early_service_request_version,
      agreement_row.listing_request_id
    );

    with required_acknowledgements as (
      select
        'agreement:scope_summary'::text as acknowledgement_key,
        'I understand the project scope summary.'::text as acknowledgement_label

      union all

      select
        'scope_item:' || listing_request_agreement_items.id::text,
        'I understand this scope item: ' || listing_request_agreement_items.title
      from public.listing_request_agreement_items
      where listing_request_agreement_items.agreement_id = p_agreement_id
        and listing_request_agreement_items.is_required = true
        and listing_request_agreement_items.is_selected = true

      union all

      select
        'agreement:payment_schedule',
        'I understand the payment schedule.'

      union all

      select
        'payment_item:' || listing_request_payment_schedule_items.id::text,
        'I understand this payment item: ' || listing_request_payment_schedule_items.title
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id = p_agreement_id

      union all

      select
        'agreement:timeline',
        'I understand the estimated completion date and buyer-side hold rules.'

      union all

      select
        'agreement:update_schedule',
        'I understand the creator update schedule.'

      union all

      select
        'agreement:revision_policy',
        'I understand the included revision policy.'

      union all

      select
        'agreement:additional_cost_policy',
        'I understand the additional cost policy.'

      union all

      select
        'agreement:change_orders',
        'I understand scope, price, timeline, deliverable, or payment changes require an accepted change order.'

      union all

      select
        'agreement:final_release_payment',
        'I understand final files or deliverables may be held until required payments are complete.'
    )
    select count(*)
    into missing_acknowledgement_count
    from required_acknowledgements
    where not exists (
      select 1
      from unnest(coalesce(p_acknowledgement_keys, '{}'::text[])) as checked_keys(acknowledgement_key)
      where checked_keys.acknowledgement_key = required_acknowledgements.acknowledgement_key
    );

    if missing_acknowledgement_count > 0 then
      raise exception 'You must acknowledge every required agreement item before accepting.'
        using errcode = 'P0001';
    end if;

    with required_acknowledgements as (
      select
        'agreement:scope_summary'::text as acknowledgement_key,
        'I understand the project scope summary.'::text as acknowledgement_label

      union all

      select
        'scope_item:' || listing_request_agreement_items.id::text,
        'I understand this scope item: ' || listing_request_agreement_items.title
      from public.listing_request_agreement_items
      where listing_request_agreement_items.agreement_id = p_agreement_id
        and listing_request_agreement_items.is_required = true
        and listing_request_agreement_items.is_selected = true

      union all

      select
        'agreement:payment_schedule',
        'I understand the payment schedule.'

      union all

      select
        'payment_item:' || listing_request_payment_schedule_items.id::text,
        'I understand this payment item: ' || listing_request_payment_schedule_items.title
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id = p_agreement_id

      union all

      select
        'agreement:timeline',
        'I understand the estimated completion date and buyer-side hold rules.'

      union all

      select
        'agreement:update_schedule',
        'I understand the creator update schedule.'

      union all

      select
        'agreement:revision_policy',
        'I understand the included revision policy.'

      union all

      select
        'agreement:additional_cost_policy',
        'I understand the additional cost policy.'

      union all

      select
        'agreement:change_orders',
        'I understand scope, price, timeline, deliverable, or payment changes require an accepted change order.'

      union all

      select
        'agreement:final_release_payment',
        'I understand final files or deliverables may be held until required payments are complete.'
    )
    insert into public.listing_request_agreement_acknowledgements (
      agreement_id,
      buyer_user_id,
      acknowledgement_key,
      acknowledgement_label
    )
    select
      p_agreement_id,
      auth.uid(),
      required_acknowledgements.acknowledgement_key,
      required_acknowledgements.acknowledgement_label
    from required_acknowledgements
    on conflict (agreement_id, buyer_user_id, acknowledgement_key)
    do update set acknowledgement_label = excluded.acknowledgement_label;
  end if;

  update public.listing_request_agreements
  set
    status = p_response,
    buyer_accepted_at = case
      when p_response = 'buyer_accepted' then now()
      else buyer_accepted_at
    end,
    buyer_declined_at = case
      when p_response = 'buyer_declined' then now()
      else buyer_declined_at
    end
  where listing_request_agreements.id = p_agreement_id;

  update public.listing_request_timeline_holds
  set ended_at = now()
  where listing_request_timeline_holds.agreement_id = p_agreement_id
    and listing_request_timeline_holds.reason = 'agreement_acceptance_pending'
    and listing_request_timeline_holds.ended_at is null;

  if p_response = 'buyer_accepted'
    and agreement_row.starting_payment_status = 'payment_required'
  then
    insert into public.listing_request_timeline_holds (
      listing_request_id,
      agreement_id,
      reason,
      started_at
    )
    values (
      agreement_row.listing_request_id,
      agreement_row.id,
      'starting_payment_pending',
      now()
    )
    on conflict do nothing;
  end if;

  return query
  select
    listing_request_agreements.id,
    listing_request_agreements.status,
    listing_request_agreements.starting_payment_status
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id;
end;
$$;

revoke all
on function public.respond_listing_request_agreement(uuid, text, text[], text)
from public, anon;

grant execute
on function public.respond_listing_request_agreement(uuid, text, text[], text)
to authenticated;
