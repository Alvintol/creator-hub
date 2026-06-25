create extension if not exists "pgcrypto";

create table if not exists public.listing_request_payments (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,

  related_entity_type text null check (
    related_entity_type is null
    or related_entity_type in (
      'agreement',
      'milestone',
      'change_order',
      'final_delivery'
    )
  ),
  related_entity_id uuid null,

  payment_type text not null check (
    payment_type in (
      'one_time',
      'starting_payment',
      'milestone_payment',
      'change_order_payment',
      'final_balance'
    )
  ),

  status text not null default 'requires_checkout' check (
    status in (
      'requires_checkout',
      'checkout_opened',
      'processing',
      'paid',
      'failed',
      'refunded',
      'partially_refunded',
      'disputed',
      'cancelled'
    )
  ),

  currency text not null check (
    currency = lower(currency)
    and currency ~ '^[a-z]{3}$'
  ),

  base_amount_cents integer not null check (base_amount_cents >= 0),
  creator_tip_cents integer not null default 0 check (creator_tip_cents >= 0),
  buyer_service_fee_cents integer not null default 0 check (buyer_service_fee_cents >= 0),
  creator_platform_fee_cents integer not null default 0 check (creator_platform_fee_cents >= 0),
  platform_support_cents integer not null default 0 check (platform_support_cents >= 0),
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  total_checkout_cents integer not null check (total_checkout_cents > 0),

  buyer_service_fee_bps integer not null default 500 check (buyer_service_fee_bps >= 0),
  creator_platform_fee_bps integer not null default 500 check (creator_platform_fee_bps >= 0),
  buyer_service_fee_minimum_cents integer not null default 100 check (buyer_service_fee_minimum_cents >= 0),
  creator_platform_fee_minimum_cents integer not null default 150 check (creator_platform_fee_minimum_cents >= 0),

  payer_user_id uuid not null references public.profiles(user_id) on delete restrict,
  creator_user_id uuid not null references public.profiles(user_id) on delete restrict,

  stripe_connected_account_id text null,
  stripe_checkout_session_id text null,
  stripe_payment_intent_id text null,
  stripe_charge_id text null,
  stripe_application_fee_id text null,
  stripe_refund_id text null,
  stripe_dispute_id text null,

  stripe_event_ids text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,

  checkout_opened_at timestamptz null,
  processing_at timestamptz null,
  paid_at timestamptz null,
  failed_at timestamptz null,
  refunded_at timestamptz null,
  disputed_at timestamptz null,
  cancelled_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    application_fee_cents =
      buyer_service_fee_cents
      + creator_platform_fee_cents
      + platform_support_cents
  ),

  check (
    total_checkout_cents =
      base_amount_cents
      + creator_tip_cents
      + buyer_service_fee_cents
      + platform_support_cents
  ),

  check (application_fee_cents < total_checkout_cents),

  check (
    (related_entity_type is null and related_entity_id is null)
    or (related_entity_type is not null and related_entity_id is not null)
  )
);

create unique index if not exists listing_request_payments_checkout_session_idx
  on public.listing_request_payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists listing_request_payments_payment_intent_idx
  on public.listing_request_payments(stripe_connected_account_id, stripe_payment_intent_id)
  where stripe_connected_account_id is not null
    and stripe_payment_intent_id is not null;

create index if not exists listing_request_payments_request_idx
  on public.listing_request_payments(listing_request_id, created_at desc);

create index if not exists listing_request_payments_status_idx
  on public.listing_request_payments(status, created_at desc);

create index if not exists listing_request_payments_payer_idx
  on public.listing_request_payments(payer_user_id, created_at desc);

create index if not exists listing_request_payments_creator_idx
  on public.listing_request_payments(creator_user_id, created_at desc);

create or replace function public.set_listing_request_payments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listing_request_payments_set_updated_at
  on public.listing_request_payments;

create trigger listing_request_payments_set_updated_at
  before update on public.listing_request_payments
  for each row
  execute function public.set_listing_request_payments_updated_at();

alter table public.listing_request_payments enable row level security;

drop policy if exists "listing request payments participants read"
  on public.listing_request_payments;

create policy "listing request payments participants read"
  on public.listing_request_payments
  for select
  to authenticated
  using (
    auth.uid() = payer_user_id
    or auth.uid() = creator_user_id
    or exists (
      select 1
      from public.admin_roles
      where admin_roles.profile_user_id = auth.uid()
    )
  );