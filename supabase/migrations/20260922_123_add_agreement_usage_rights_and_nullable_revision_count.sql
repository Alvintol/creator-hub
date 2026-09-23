-- Sprint 4 (launch-scope.md sections 5.3 and 5.4): two agreement-schema
-- gaps identified while building cancellation, fixed in the same pass.

-- 5.3 -- structured usage rights, snapshotted onto the agreement the same
-- way scope_summary and every other agreement term already is: each
-- agreement version is its own immutable row, so storing the grant directly
-- on it *is* the snapshot. Nullable rather than required, because existing
-- agreements (draft, sent, or already buyer_accepted) never captured a
-- choice and backfilling one would misrepresent what was actually agreed.
-- New agreements should have this required by the agreement-builder form,
-- not by a fabricated database default.
alter table public.listing_request_agreements
add column if not exists usage_rights_type text null;

alter table public.listing_request_agreements
add column if not exists usage_rights_qualifier text null;

alter table public.listing_request_agreements
drop constraint if exists listing_request_agreements_usage_rights_type_check;

alter table public.listing_request_agreements
add constraint listing_request_agreements_usage_rights_type_check
check (
  usage_rights_type is null
  or usage_rights_type in (
    'personal_use',
    'creators_own_channel_use',
    'commercial_use',
    'exclusive_buyer_owner'
  )
);

alter table public.listing_request_agreements
drop constraint if exists listing_request_agreements_usage_rights_qualifier_check;

alter table public.listing_request_agreements
add constraint listing_request_agreements_usage_rights_qualifier_check
check (
  usage_rights_qualifier is null
  or char_length(btrim(usage_rights_qualifier)) <= 2000
);

-- A qualifier without a base grant type is meaningless.
alter table public.listing_request_agreements
drop constraint if exists listing_request_agreements_usage_rights_pairing_check;

alter table public.listing_request_agreements
add constraint listing_request_agreements_usage_rights_pairing_check
check (
  usage_rights_qualifier is null
  or usage_rights_type is not null
);

-- 5.4 -- included_revision_count: null now means "not stated," which the
-- product applies Refund Policy section 5's two-round fallback to. A
-- stored 0 was indistinguishable from "not stated" and stays exactly what
-- it was on every existing row -- this migration does not touch data, only
-- what a *future* agreement is allowed to leave unset.
alter table public.listing_request_agreements
alter column included_revision_count drop not null;

alter table public.listing_request_agreements
alter column included_revision_count drop default;

alter table public.listing_request_agreements
drop constraint if exists listing_request_agreements_included_revision_count_check;

alter table public.listing_request_agreements
add constraint listing_request_agreements_included_revision_count_check
check (
  included_revision_count is null
  or (
    included_revision_count >= 0
    and included_revision_count <= 20
  )
);

notify pgrst, 'reload schema';
