create extension if not exists "pgcrypto";

create table if not exists public.creator_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  stripe_account_id text not null check (char_length(btrim(stripe_account_id)) >= 3),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  country text not null check (
    country = upper(country)
    and country ~ '^[A-Z]{2}$'
  ),
  default_currency text not null check (
    default_currency = lower(default_currency)
    and default_currency ~ '^[a-z]{3}$'
  ),
  onboarding_started_at timestamptz null,
  onboarding_completed_at timestamptz null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_payment_accounts_user_provider_idx
  on public.creator_payment_accounts(user_id, provider);

create unique index if not exists creator_payment_accounts_stripe_account_idx
  on public.creator_payment_accounts(stripe_account_id)
  where provider = 'stripe';

create index if not exists creator_payment_accounts_ready_idx
  on public.creator_payment_accounts(user_id)
  where provider = 'stripe'
    and charges_enabled = true
    and payouts_enabled = true
    and details_submitted = true;

create or replace function public.set_creator_payment_accounts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_payment_accounts_set_updated_at
  on public.creator_payment_accounts;

create trigger creator_payment_accounts_set_updated_at
  before update on public.creator_payment_accounts
  for each row
  execute function public.set_creator_payment_accounts_updated_at();

create or replace function public.has_ready_creator_payment_account(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creator_payment_accounts
    where creator_payment_accounts.user_id = target_user_id
      and creator_payment_accounts.provider = 'stripe'
      and creator_payment_accounts.charges_enabled = true
      and creator_payment_accounts.payouts_enabled = true
      and creator_payment_accounts.details_submitted = true
      and creator_payment_accounts.country ~ '^[A-Z]{2}$'
      and creator_payment_accounts.default_currency ~ '^[a-z]{3}$'
  );
$$;

revoke all on function public.has_ready_creator_payment_account(uuid) from public;
grant execute on function public.has_ready_creator_payment_account(uuid) to authenticated;

alter table public.creator_payment_accounts enable row level security;

drop policy if exists "creator payment accounts participants read"
  on public.creator_payment_accounts;

create policy "creator payment accounts participants read"
  on public.creator_payment_accounts
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.admin_roles
      where admin_roles.profile_user_id = auth.uid()
    )
  );