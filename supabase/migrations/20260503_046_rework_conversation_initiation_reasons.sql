-- Reworks non-request conversation initiation topics.
-- Inquiry conversations require a structured topic.
-- Listing request conversations remain exempt because the request itself is the structured context.

alter table public.conversations
add column if not exists initiation_reason_code text null;

-- Keep existing request-linked conversations exempt.
update public.conversations
set initiation_reason_code = null
where conversation_type = 'listing_request';

-- Site is not live, so normalize any old/null inquiry topic values.
update public.conversations
set initiation_reason_code = 'listing_clarification'
where conversation_type in ('creator_inquiry', 'listing_inquiry')
  and (
    initiation_reason_code is null
    or initiation_reason_code = 'other'
  );

alter table public.conversations
drop constraint if exists conversations_initiation_reason_code_check;

alter table public.conversations
add constraint conversations_initiation_reason_code_check
check (
  (
    conversation_type = 'listing_request'
    and initiation_reason_code is null
  )
  or
  (
    conversation_type in ('creator_inquiry', 'listing_inquiry')
    and initiation_reason_code = any (
      array[
        'custom_quote'::text,
        'style_fit'::text,
        'scope_or_complexity'::text,
        'timeline_availability'::text,
        'pricing'::text,
        'deliverables'::text,
        'usage_rights'::text,
        'reference_requirements'::text,
        'revision_policy'::text,
        'commercial_use'::text,
        'file_formats'::text,
        'bundle_or_multiple_items'::text,
        'commission_availability'::text,
        'listing_clarification'::text,
        'before_requesting'::text
      ]
    )
  )
);

create index if not exists conversations_initiation_reason_code_idx
on public.conversations using btree (
  initiation_reason_code
);