-- Append-only record of which policy version a user accepted, and when.
-- This is the piece that actually protects CreatorHub in a dispute: the
-- policy text itself proves nothing about who agreed to which version.
-- Deliberately no update/delete policy — an acceptance record should never
-- be editable after the fact. Superseding a choice means inserting a new
-- row, not changing an old one.

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(user_id) on delete cascade,

  policy_type text not null check (
    policy_type in (
      'terms',
      'creator_terms',
      'privacy',
      'refund',
      'copyright',
      'payment_terms',
      'cookie',
      'community'
    )
  ),

  policy_version text not null,

  -- Optional link to the specific thing acceptance was tied to (e.g. a
  -- listing_request agreement), for policies accepted at a transaction
  -- boundary rather than at signup. Left null for account-level acceptance
  -- (signup, settings, creator payment activation).
  related_listing_request_id uuid
    references public.listing_requests(id) on delete set null,

  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists policy_acceptances_user_id_idx
  on public.policy_acceptances (user_id);

create index if not exists policy_acceptances_user_policy_idx
  on public.policy_acceptances (user_id, policy_type, accepted_at desc);

alter table public.policy_acceptances enable row level security;

-- Users can record their own acceptance and read their own history.
drop policy if exists "policy acceptances insert own" on public.policy_acceptances;
create policy "policy acceptances insert own"
on public.policy_acceptances
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "policy acceptances read own" on public.policy_acceptances;
create policy "policy acceptances read own"
on public.policy_acceptances
for select
to authenticated
using (auth.uid() = user_id);

-- Admins can look up acceptance history for support, disputes and audits.
drop policy if exists "policy acceptances admin read" on public.policy_acceptances;
create policy "policy acceptances admin read"
on public.policy_acceptances
for select
to authenticated
using (
  exists (
    select 1 from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  )
);
