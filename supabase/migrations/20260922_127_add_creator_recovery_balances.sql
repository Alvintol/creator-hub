-- Sprint 5 (launch-scope.md section 6.5): platform-funded refunds and
-- creator recovery balances.
--
-- When a buyer refund cannot be fully covered from the creator's held
-- Stripe balance, Made for Stream funds the shortfall and recovers it from
-- the creator through the app rather than making the buyer wait. This is
-- the ledger for that: one row per creator with the current outstanding
-- amount (kept as a running total for fast reads, e.g. the RLS check in
-- 20260922_128), and an immutable entries table recording every debit
-- (a refund the platform funded) and credit (a recovery, whether diverted
-- from a later payment, paid directly, or written off).

create table if not exists public.creator_recovery_balances (
  creator_user_id uuid primary key references public.profiles(user_id) on delete cascade,
  currency text not null,
  outstanding_cents integer not null default 0 check (outstanding_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_creator_recovery_balances_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_recovery_balances_set_updated_at
  on public.creator_recovery_balances;

create trigger creator_recovery_balances_set_updated_at
  before update on public.creator_recovery_balances
  for each row
  execute function public.set_creator_recovery_balances_updated_at();

create table if not exists public.creator_recovery_entries (
  id uuid primary key default gen_random_uuid(),

  creator_user_id uuid not null references public.profiles(user_id) on delete cascade,

  entry_type text not null check (entry_type in ('debit', 'credit', 'write_off')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,

  reason text not null check (
    char_length(btrim(reason)) >= 3
    and char_length(btrim(reason)) <= 500
  ),

  -- The refund that opened or added to a debit, when this entry is one.
  related_refund_id uuid null references public.listing_request_payment_refunds(id),
  -- The payment whose application fee funded a credit via diversion, when
  -- this entry is one (section 6.6).
  related_payment_id uuid null references public.listing_request_payments(id),

  -- null for an automatic entry (diversion, or the debit itself); set for an
  -- admin write-off or a creator's direct settlement charge.
  actor_user_id uuid null references public.profiles(user_id),

  created_at timestamptz not null default now()
);

create index if not exists creator_recovery_entries_creator_idx
  on public.creator_recovery_entries(creator_user_id, created_at desc);

alter table public.creator_recovery_balances enable row level security;
alter table public.creator_recovery_entries enable row level security;

drop policy if exists "creator reads own recovery balance"
  on public.creator_recovery_balances;

create policy "creator reads own recovery balance"
  on public.creator_recovery_balances
  for select
  to authenticated
  using (
    creator_user_id = auth.uid()
    or public.is_admin_user(auth.uid())
  );

drop policy if exists "creator reads own recovery entries"
  on public.creator_recovery_entries;

create policy "creator reads own recovery entries"
  on public.creator_recovery_entries
  for select
  to authenticated
  using (
    creator_user_id = auth.uid()
    or public.is_admin_user(auth.uid())
  );

-- No insert/update/delete policy for any client role -- every write goes
-- through the functions below.

-- Internal. One debit when the platform funds a refund shortfall; the
-- balance row is created on first debit and never deleted (a creator who
-- clears it and later incurs another debt reuses the same row).
create or replace function public.apply_creator_recovery_debit(
  p_creator_user_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_reason text,
  p_related_refund_id uuid default null
)
returns public.creator_recovery_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.creator_recovery_balances%rowtype;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'A recovery debit must be greater than zero.'
      using errcode = '22023';
  end if;

  insert into public.creator_recovery_balances (creator_user_id, currency, outstanding_cents)
  values (p_creator_user_id, lower(p_currency), 0)
  on conflict (creator_user_id) do nothing;

  update public.creator_recovery_balances
  set outstanding_cents = outstanding_cents + p_amount_cents
  where creator_user_id = p_creator_user_id
  returning * into balance_row;

  insert into public.creator_recovery_entries (
    creator_user_id, entry_type, amount_cents, currency, reason, related_refund_id
  )
  values (
    p_creator_user_id, 'debit', p_amount_cents, lower(p_currency), btrim(p_reason), p_related_refund_id
  );

  return balance_row;
end;
$$;

revoke all on function public.apply_creator_recovery_debit(uuid, integer, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.apply_creator_recovery_debit(uuid, integer, text, text, uuid)
  to service_role;

-- Internal. One credit per recovery -- a diverted instalment, a direct
-- settlement, or a write-off. Floors at zero rather than raising if a
-- caller ever overshoots by a rounding cent; automatic release is simply
-- "outstanding_cents reached zero," read by 20260922_128's RLS check and by
-- the creator settings UI, with no separate status column to fall out of
-- sync.
create or replace function public.apply_creator_recovery_credit(
  p_creator_user_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_reason text,
  p_entry_type text default 'credit',
  p_related_payment_id uuid default null,
  p_actor_user_id uuid default null
)
returns public.creator_recovery_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.creator_recovery_balances%rowtype;
  applied_amount integer;
begin
  if p_entry_type not in ('credit', 'write_off') then
    raise exception 'Unknown recovery entry type: %.', p_entry_type
      using errcode = '22023';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'A recovery credit must be greater than zero.'
      using errcode = '22023';
  end if;

  select *
  into balance_row
  from public.creator_recovery_balances
  where creator_user_id = p_creator_user_id
  for update;

  if not found then
    raise exception 'Creator % has no recovery balance to credit.', p_creator_user_id
      using errcode = 'P0001';
  end if;

  applied_amount := least(p_amount_cents, balance_row.outstanding_cents);

  update public.creator_recovery_balances
  set outstanding_cents = outstanding_cents - applied_amount
  where creator_user_id = p_creator_user_id
  returning * into balance_row;

  insert into public.creator_recovery_entries (
    creator_user_id, entry_type, amount_cents, currency, reason,
    related_payment_id, actor_user_id
  )
  values (
    p_creator_user_id, p_entry_type, applied_amount, lower(p_currency), btrim(p_reason),
    p_related_payment_id, p_actor_user_id
  );

  return balance_row;
end;
$$;

revoke all on function public.apply_creator_recovery_credit(uuid, integer, text, text, text, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.apply_creator_recovery_credit(uuid, integer, text, text, text, uuid, uuid)
  to service_role;

-- Admin-only write-off for a balance that will never be recovered
-- (checklist item: "Admin write-off action for an unrecoverable balance").
-- Callable directly by an authenticated admin, unlike the two functions
-- above -- this is a user-facing admin action, not an internal step of the
-- refund or payment-workflow chain.
create or replace function public.admin_write_off_creator_recovery_balance(
  p_creator_user_id uuid,
  p_reason text
)
returns public.creator_recovery_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.creator_recovery_balances%rowtype;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can write off a recovery balance.'
      using errcode = '42501';
  end if;

  if clean_reason is null or char_length(clean_reason) < 10 then
    raise exception 'A write-off reason of at least 10 characters is required.'
      using errcode = '22023';
  end if;

  select *
  into balance_row
  from public.creator_recovery_balances
  where creator_user_id = p_creator_user_id
  for update;

  if not found or balance_row.outstanding_cents = 0 then
    raise exception 'Creator % has no outstanding recovery balance.', p_creator_user_id
      using errcode = 'P0001';
  end if;

  return public.apply_creator_recovery_credit(
    p_creator_user_id,
    balance_row.outstanding_cents,
    balance_row.currency,
    clean_reason,
    'write_off',
    null,
    auth.uid()
  );
end;
$$;

revoke all on function public.admin_write_off_creator_recovery_balance(uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_write_off_creator_recovery_balance(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
