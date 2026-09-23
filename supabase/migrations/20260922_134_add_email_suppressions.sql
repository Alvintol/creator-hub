-- Sprint 6 (launch-scope.md section 7.1): suppression-list handling, so a
-- hard bounce does not silently restart a notice clock that nobody
-- received. api/email.js checks this table (as the service role, which
-- bypasses RLS) before every send; a hard-bounce webhook or an admin action
-- adds to it. No client role can read or write this table -- an email
-- address's bounce history is not something either party to a request
-- should see about the other, and there is no product surface that needs
-- it beyond the API's own pre-send check and admin support tooling (which
-- also runs as the service role).

create table if not exists public.email_suppressions (
  email text primary key,

  reason text not null check (
    reason in ('hard_bounce', 'complaint', 'manual')
  ),

  detail text null check (detail is null or char_length(btrim(detail)) <= 1000),

  -- The provider's message id for the send that caused this, when known --
  -- ties a suppression back to the specific notice/receipt in
  -- listing_request_notices.email_provider_message_id for support
  -- investigation.
  source_provider_message_id text null,

  suppressed_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;

-- No policies at all: RLS with zero policies denies every client-role
-- request by default. Only the service role (which bypasses RLS) reads or
-- writes this table, from api/email.js and the bounce webhook handler.

notify pgrst, 'reload schema';
