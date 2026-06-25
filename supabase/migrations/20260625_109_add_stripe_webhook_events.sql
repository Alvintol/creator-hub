create extension if not exists "pgcrypto";

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_account_id text null,
  event_type text not null,
  processing_status text not null default 'processing' check (
    processing_status in ('processing', 'processed', 'failed', 'ignored')
  ),
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists stripe_webhook_events_account_idx
  on public.stripe_webhook_events(stripe_account_id, created_at desc);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events(event_type, created_at desc);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events(processing_status, created_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "stripe webhook events admin read"
  on public.stripe_webhook_events;

create policy "stripe webhook events admin read"
  on public.stripe_webhook_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_roles
      where admin_roles.profile_user_id = auth.uid()
    )
  );