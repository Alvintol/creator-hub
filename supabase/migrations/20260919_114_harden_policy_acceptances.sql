-- Follow-up to 20260917_113_add_policy_acceptances.sql. Apply after 113, and
-- review both together before either is applied.
--
-- 1. Adds 'early_service_request': the buyer's express request for work to
--    begin before any EU/UK 14-day cancellation period ends (Refund Policy
--    section 1). It is recorded separately from the general refund-policy
--    acceptance so each can be evidenced on its own. The checkout page
--    records it, and inserts fail until this constraint allows it.
--
-- 2. Makes accepted_at and created_at server-set. Migration 113 leaves them as
--    column defaults, which a client can override on insert. An acceptance
--    record that the user can backdate is weak evidence.
--
-- 3. Limits related_listing_request_id to requests where the user is the
--    buyer. Migration 113 allows any request id, so a user could attach an
--    acceptance to someone else's project.
--
-- 4. Keeps acceptance records when an account or request is removed.
--    Migration 113 deleted a user's acceptances with their profile
--    (on delete cascade) and blanked the request link (on delete set null).
--    Closing an account deletes or anonymises personal data, but the record
--    of what was agreed is kept for the periods in Privacy Policy section 8.
--    Both ids stay as plain uuids; the insert policy below still checks
--    them when a row is written.

alter table public.policy_acceptances
  drop constraint if exists policy_acceptances_policy_type_check;

alter table public.policy_acceptances
  add constraint policy_acceptances_policy_type_check check (
    policy_type in (
      'terms',
      'creator_terms',
      'privacy',
      'refund',
      'copyright',
      'payment_terms',
      'cookie',
      'community',
      'early_service_request'
    )
  );

create or replace function public.set_policy_acceptance_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.accepted_at := now();
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists policy_acceptances_set_timestamps
  on public.policy_acceptances;

create trigger policy_acceptances_set_timestamps
  before insert on public.policy_acceptances
  for each row
  execute function public.set_policy_acceptance_timestamps();

drop policy if exists "policy acceptances insert own" on public.policy_acceptances;
create policy "policy acceptances insert own"
on public.policy_acceptances
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    related_listing_request_id is null
    or exists (
      select 1
      from public.listing_requests
      where listing_requests.id = related_listing_request_id
        and listing_requests.buyer_user_id = auth.uid()
    )
  )
);

-- Acceptance records outlive the account and request they refer to.
alter table public.policy_acceptances
  drop constraint if exists policy_acceptances_user_id_fkey;

alter table public.policy_acceptances
  drop constraint if exists policy_acceptances_related_listing_request_id_fkey;

comment on table public.policy_acceptances is
  'Append-only record of accepted policy versions. Kept after account closure for the retention periods in Privacy Policy section 8; never updated or rewritten.';
