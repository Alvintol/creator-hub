-- Sprint 9: Stripe account state and operational alerting.
--
-- 1. creator_payment_accounts learns when its state was observed at Stripe,
--    and refuses to let an older observation replace a newer one. Every
--    writer (settings sync, onboarding, the v2 thin-event handler, the
--    scheduled resync) builds its row with api/connectAccountState.js and
--    stamps stripe_state_observed_at, so a replayed or out-of-order event
--    cannot move an account backwards.
-- 2. A creator whose account is not ready cannot start new paid work --
--    submit a request to them, send or accept an agreement, or send or
--    accept a price-increasing change order -- using the same
--    has_ready_creator_payment_account check that gates publishing
--    (20260622_107). Live listings are left alone: unpublishing is a
--    business decision (CON-003). Payments already owed on accepted work
--    are left alone too; checkout already refuses an unready account at the
--    API (PAY-003).
-- 3. list_ops_alerts() returns every open operational alert, each naming the
--    playbook issue it points to, for the hourly alert run
--    (POST /api/internal/ops/alerts/run). ops_alert_notifications records
--    what has been emailed so an alert is sent once, then reminded daily.
--
-- Playbooks: payments/connect-onboarding.md (CON-003, CON-006, CON-007),
-- operations/alerting.md.

-- ---------------------------------------------------------------------------
-- 1. Account state and ordering
-- ---------------------------------------------------------------------------

alter table public.creator_payment_accounts
  add column if not exists stripe_state_observed_at timestamptz,
  add column if not exists readiness_lost_at timestamptz,
  add column if not exists requirements_due_count integer not null default 0,
  add column if not exists requirements_past_due_count integer not null default 0;

alter table public.creator_payment_accounts
  drop constraint if exists creator_payment_accounts_requirement_counts_check;

alter table public.creator_payment_accounts
  add constraint creator_payment_accounts_requirement_counts_check
  check (
    requirements_due_count >= 0
    and requirements_past_due_count >= 0
    and requirements_past_due_count <= requirements_due_count
  );

-- Rows written before this migration were observed when they were synced.
update public.creator_payment_accounts
set stripe_state_observed_at = last_synced_at
where stripe_state_observed_at is null
  and last_synced_at is not null;

create or replace function public.guard_creator_payment_account_state_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_ready boolean;
  is_ready boolean;
begin
  -- A write that is not strictly newer than what is recorded keeps the
  -- recorded Stripe state. Equal timestamps are the same observation
  -- replayed, so keeping the old values changes nothing. A write with no
  -- timestamp is not from the API's mapping and cannot change readiness.
  if old.stripe_state_observed_at is not null
    and (
      new.stripe_state_observed_at is null
      or new.stripe_state_observed_at <= old.stripe_state_observed_at
    )
  then
    new.charges_enabled := old.charges_enabled;
    new.payouts_enabled := old.payouts_enabled;
    new.details_submitted := old.details_submitted;
    new.requirements_due_count := old.requirements_due_count;
    new.requirements_past_due_count := old.requirements_past_due_count;
    new.onboarding_completed_at := old.onboarding_completed_at;
    new.tax_entity_type := old.tax_entity_type;
    new.tax_id_types := old.tax_id_types;
    new.last_synced_at := old.last_synced_at;
    new.stripe_state_observed_at := old.stripe_state_observed_at;
  end if;

  was_ready := old.charges_enabled and old.payouts_enabled and old.details_submitted;
  is_ready := new.charges_enabled and new.payouts_enabled and new.details_submitted;

  if is_ready then
    new.readiness_lost_at := null;
  elsif was_ready then
    new.readiness_lost_at := now();
  else
    new.readiness_lost_at := old.readiness_lost_at;
  end if;

  return new;
end;
$$;

drop trigger if exists creator_payment_accounts_guard_state_order
  on public.creator_payment_accounts;

create trigger creator_payment_accounts_guard_state_order
  before update
  on public.creator_payment_accounts
  for each row
  execute function public.guard_creator_payment_account_state_order();

-- ---------------------------------------------------------------------------
-- 2. No new paid work for an unready account
-- ---------------------------------------------------------------------------

-- p_actor: 'creator' when the creator is the one acting (sending), 'buyer'
-- when the buyer is (submitting, accepting). The two messages are the
-- signals documented in connect-onboarding.md CON-007.
create or replace function public.assert_creator_ready_for_paid_work(
  p_creator_user_id uuid,
  p_actor text
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.has_ready_creator_payment_account(p_creator_user_id) then
    return;
  end if;

  if p_actor = 'creator' then
    raise exception
      'Your payout account needs attention before you can send paid work. Open Settings and finish what Stripe is asking for, then try again.'
      using errcode = 'check_violation';
  end if;

  raise exception
    'This creator cannot take new paid work right now because their payout account needs attention. Please try again later.'
    using errcode = 'check_violation';
end;
$$;

revoke all on function public.assert_creator_ready_for_paid_work(uuid, text)
from public, anon, authenticated;

create or replace function public.enforce_listing_request_creator_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'submitted' then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'buyer');
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_require_creator_readiness
  on public.listing_requests;

create trigger listing_requests_require_creator_readiness
  before insert
  on public.listing_requests
  for each row
  execute function public.enforce_listing_request_creator_readiness();

create or replace function public.enforce_listing_request_agreement_creator_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.total_amount, 0) <= 0
    or (tg_op = 'UPDATE' and new.status is not distinct from old.status)
  then
    return new;
  end if;

  if new.status = 'sent' then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'creator');
  elsif new.status = 'buyer_accepted' then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'buyer');
  end if;

  return new;
end;
$$;

drop trigger if exists listing_request_agreements_require_creator_readiness
  on public.listing_request_agreements;

create trigger listing_request_agreements_require_creator_readiness
  before insert or update of status
  on public.listing_request_agreements
  for each row
  execute function public.enforce_listing_request_agreement_creator_readiness();

create or replace function public.enforce_listing_request_change_order_creator_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(new.changes_price, false)
    or coalesce(new.price_delta, 0) <= 0
    or (tg_op = 'UPDATE' and new.status is not distinct from old.status)
  then
    return new;
  end if;

  if new.status = 'sent' then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'creator');
  elsif new.status = 'buyer_accepted' then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'buyer');
  end if;

  return new;
end;
$$;

drop trigger if exists listing_request_change_orders_require_creator_readiness
  on public.listing_request_change_orders;

create trigger listing_request_change_orders_require_creator_readiness
  before insert or update of status
  on public.listing_request_change_orders
  for each row
  execute function public.enforce_listing_request_change_order_creator_readiness();

-- ---------------------------------------------------------------------------
-- 3. Operational alerts
-- ---------------------------------------------------------------------------

-- Each branch is one alert. alert_id and playbook_issue must match
-- api/opsAlerts.js's registry (opsAlerts.test.js checks this file).
create or replace function public.list_ops_alerts()
returns table (
  alert_id text,
  playbook_issue text,
  subject_id text,
  observed_at timestamptz,
  detail jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  -- PAY-005. Checkout sessions expire after 24 hours, so a session still
  -- open after 25 means the expiry (or payment) webhook never landed.
  -- 'processing' is a delayed payment method and is only raised after 7
  -- days. Younger stuck payments are the agent's 30-minute signal, not an
  -- email.
  select
    'stuck_payment'::text,
    'PAY-005'::text,
    p.id::text,
    p.updated_at,
    jsonb_build_object(
      'status', p.status,
      'currency', p.currency,
      'total_checkout_cents', p.total_checkout_cents,
      'listing_request_id', p.listing_request_id
    )
  from public.listing_request_payments p
  where (p.status = 'checkout_opened' and p.updated_at < now() - interval '25 hours')
     or (p.status = 'processing' and p.updated_at < now() - interval '7 days')

  union all

  -- CHG-003. An accepted price-increasing change order should have a
  -- schedule item (create_listing_request_change_order_payment) and that
  -- item a payment (create_listing_request_payment_when_schedule_item_required).
  select
    'change_order_payment_missing',
    'CHG-003',
    co.id::text,
    co.buyer_accepted_at,
    jsonb_build_object(
      'listing_request_id', co.listing_request_id,
      'price_delta', co.price_delta,
      'revised_total_amount', co.revised_total_amount,
      'has_schedule_item', exists (
        select 1 from public.listing_request_payment_schedule_items si
        where si.change_order_id = co.id
      )
    )
  from public.listing_request_change_orders co
  where co.status = 'buyer_accepted'
    and co.changes_price
    and co.price_delta > 0
    and coalesce(co.buyer_accepted_at, co.updated_at) < now() - interval '15 minutes'
    and not exists (
      select 1
      from public.listing_request_payment_schedule_items si
      join public.listing_request_payments p
        on p.payment_schedule_item_id = si.id
      where si.change_order_id = co.id
    )

  union all

  -- REQ-003 (Sprint 6's staleness query).
  select
    'stale_request',
    'REQ-003',
    s.listing_request_id::text,
    s.last_activity_at,
    jsonb_build_object(
      'days_since_activity', s.days_since_activity,
      'has_open_notice', s.has_open_notice
    )
  from public.admin_list_stale_listing_requests(14) s

  union all

  -- TAX-002.
  select
    'tax_evidence_insufficient',
    'TAX-002',
    p.id::text,
    p.paid_at,
    jsonb_build_object(
      'evidence_status', e.evidence_status,
      'tax_jurisdiction_country', p.tax_jurisdiction_country,
      'conflicting_country', e.conflicting_country
    )
  from public.listing_request_payments p
  cross join lateral public.get_listing_request_payment_tax_evidence_status(p.id) e
  where p.tax_treatment = 'calculated'
    and p.status in ('paid', 'partially_refunded', 'refunded')
    and e.evidence_status <> 'sufficient'

  union all

  -- TAX-003.
  select
    'tax_transaction_missing',
    'TAX-003',
    p.id::text,
    p.paid_at,
    jsonb_build_object('stripe_tax_calculation_id', p.stripe_tax_calculation_id)
  from public.listing_request_payments p
  where p.tax_treatment = 'calculated'
    and p.status in ('paid', 'partially_refunded', 'refunded')
    and p.stripe_tax_transaction_id is null
    and p.paid_at < now() - interval '1 hour'

  union all

  -- TAX-004. The reversal is created right after the refund; an hour's
  -- grace keeps an in-flight refund out of the alert.
  select
    'tax_reversal_missing',
    'TAX-004',
    r.id::text,
    r.created_at,
    jsonb_build_object(
      'payment_id', r.payment_id,
      'stripe_refund_id', r.stripe_refund_id,
      'tax_refund_cents', r.tax_refund_cents
    )
  from public.listing_request_payment_refunds r
  where r.tax_refund_cents > 0
    and r.stripe_tax_reversal_id is null
    and r.created_at < now() - interval '1 hour'

  union all

  -- TAX-007. Wave 2 currencies are enabled while the tax advice is open.
  select
    'paid_wave2_currency',
    'TAX-007',
    p.id::text,
    p.paid_at,
    jsonb_build_object('currency', p.currency, 'status', p.status)
  from public.listing_request_payments p
  where p.currency not in ('cad', 'usd')
    and p.paid_at is not null

  union all

  -- CON-003. Stripe restricted an account that still has live listings.
  select
    'payment_account_lost_readiness',
    'CON-003',
    a.user_id::text,
    a.readiness_lost_at,
    jsonb_build_object(
      'stripe_account_id', a.stripe_account_id,
      'charges_enabled', a.charges_enabled,
      'payouts_enabled', a.payouts_enabled,
      'details_submitted', a.details_submitted,
      'requirements_due_count', a.requirements_due_count,
      'requirements_past_due_count', a.requirements_past_due_count,
      'active_listing_count', (
        select count(*) from public.listings l
        where l.user_id = a.user_id and l.status = 'published' and l.is_active
      )
    )
  from public.creator_payment_accounts a
  where a.readiness_lost_at is not null
    and not (a.charges_enabled and a.payouts_enabled and a.details_submitted)
    and exists (
      select 1 from public.listings l
      where l.user_id = a.user_id and l.status = 'published' and l.is_active
    )

  union all

  -- CON-006. The hourly resync refreshes anything older than 6 hours, so a
  -- mirror 48 hours old means the resync is not running or is failing.
  select
    'payment_account_mirror_stale',
    'CON-006',
    a.user_id::text,
    a.last_synced_at,
    jsonb_build_object('stripe_account_id', a.stripe_account_id)
  from public.creator_payment_accounts a
  where a.last_synced_at is null
     or a.last_synced_at < now() - interval '48 hours';
$$;

revoke all on function public.list_ops_alerts() from public, anon, authenticated;
grant execute on function public.list_ops_alerts() to service_role;

create table if not exists public.ops_alert_notifications (
  alert_id text not null,
  subject_id text not null,
  playbook_issue text not null,
  first_seen_at timestamptz not null default now(),
  last_notified_at timestamptz,
  primary key (alert_id, subject_id)
);

-- Service role only: no policies, so RLS refuses everyone else.
alter table public.ops_alert_notifications enable row level security;

revoke all on table public.ops_alert_notifications from anon, authenticated;

notify pgrst, 'reload schema';
