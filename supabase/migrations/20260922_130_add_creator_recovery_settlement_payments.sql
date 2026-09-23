-- Sprint 5 (launch-scope.md section 6.5): "Paying it off directly -- the
-- creator can settle the balance in the app at any time, by card, which
-- lifts the block immediately." This charge is on the creator's own card,
-- to the platform's own Stripe account -- never through the connected
-- account, since this is the creator paying Made for Stream back, not a
-- marketplace transaction with an application fee. Same Stripe Checkout
-- mechanism as every other payment in this product (hosted/embedded
-- Checkout, never raw card details in our own code), just without
-- `stripeAccount` or `application_fee_amount`.

create table if not exists public.creator_recovery_settlement_payments (
  id uuid primary key default gen_random_uuid(),

  creator_user_id uuid not null references public.profiles(user_id) on delete cascade,

  amount_cents integer not null check (amount_cents > 0),
  currency text not null,

  status text not null default 'requires_checkout' check (
    status in ('requires_checkout', 'checkout_opened', 'paid', 'failed', 'cancelled')
  ),

  stripe_checkout_session_id text null,
  stripe_payment_intent_id text null,

  checkout_opened_at timestamptz null,
  paid_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_recovery_settlement_payments_session_idx
  on public.creator_recovery_settlement_payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists creator_recovery_settlement_payments_creator_idx
  on public.creator_recovery_settlement_payments(creator_user_id, created_at desc);

create or replace function public.set_creator_recovery_settlement_payments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_recovery_settlement_payments_set_updated_at
  on public.creator_recovery_settlement_payments;

create trigger creator_recovery_settlement_payments_set_updated_at
  before update on public.creator_recovery_settlement_payments
  for each row
  execute function public.set_creator_recovery_settlement_payments_updated_at();

alter table public.creator_recovery_settlement_payments enable row level security;

drop policy if exists "creator reads own recovery settlement payments"
  on public.creator_recovery_settlement_payments;

create policy "creator reads own recovery settlement payments"
  on public.creator_recovery_settlement_payments
  for select
  to authenticated
  using (
    creator_user_id = auth.uid()
    or public.is_admin_user(auth.uid())
  );

-- No insert/update/delete policy for any client role -- api/server.js
-- (service role) creates the row when it creates the Stripe Checkout
-- session, and the webhook applies it below when Stripe confirms payment.

-- Idempotent: a webhook redelivery for an already-paid settlement is a
-- no-op, matching the shape of apply_paid_listing_request_starting_payment.
create or replace function public.apply_paid_creator_recovery_settlement(
  p_settlement_id uuid
)
returns public.creator_recovery_settlement_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  settlement_row public.creator_recovery_settlement_payments%rowtype;
begin
  select *
  into settlement_row
  from public.creator_recovery_settlement_payments
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Recovery settlement payment % was not found.', p_settlement_id
      using errcode = 'P0001';
  end if;

  if settlement_row.status = 'paid' then
    return settlement_row;
  end if;

  update public.creator_recovery_settlement_payments
  set status = 'paid', paid_at = coalesce(paid_at, now())
  where id = settlement_row.id
  returning * into settlement_row;

  perform public.apply_creator_recovery_credit(
    settlement_row.creator_user_id,
    settlement_row.amount_cents,
    settlement_row.currency,
    format('Direct settlement payment %s.', settlement_row.id),
    'credit',
    null,
    settlement_row.creator_user_id
  );

  return settlement_row;
end;
$$;

revoke all on function public.apply_paid_creator_recovery_settlement(uuid)
  from public, anon, authenticated;

grant execute on function public.apply_paid_creator_recovery_settlement(uuid)
  to service_role;

notify pgrst, 'reload schema';
