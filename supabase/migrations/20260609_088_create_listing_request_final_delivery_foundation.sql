create table if not exists public.listing_request_final_deliveries (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null
    references public.listing_requests(id)
    on delete cascade,

  agreement_id uuid not null
    references public.listing_request_agreements(id)
    on delete cascade,

  creator_user_id uuid not null,
  buyer_user_id uuid not null,

  version_number integer not null default 1
    check (version_number >= 1),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'submitted',
        'revision_requested',
        'buyer_approved',
        'cancelled',
        'superseded'
      )
    ),

  title text not null
    check (
      char_length(btrim(title)) >= 3
      and char_length(btrim(title)) <= 160
    ),

  summary text not null
    check (
      char_length(btrim(summary)) >= 10
      and char_length(btrim(summary)) <= 4000
    ),

  delivery_links text[] not null default '{}'::text[]
    check (cardinality(delivery_links) <= 20),

  agreement_snapshot jsonb not null
    check (jsonb_typeof(agreement_snapshot) = 'object'),

  revision_request_reason text null
    check (
      revision_request_reason is null
      or char_length(btrim(revision_request_reason)) <= 2000
    ),

  submitted_at timestamptz null,
  revision_requested_at timestamptz null,
  buyer_approved_at timestamptz null,
  cancelled_at timestamptz null,
  superseded_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    status <> 'submitted'
    or submitted_at is not null
  ),

  check (
    status <> 'revision_requested'
    or (
      submitted_at is not null
      and revision_requested_at is not null
    )
  ),

  check (
    status <> 'buyer_approved'
    or (
      submitted_at is not null
      and buyer_approved_at is not null
    )
  )
);

create index if not exists
listing_request_final_deliveries_request_idx
on public.listing_request_final_deliveries(
  listing_request_id,
  version_number desc
);

create index if not exists
listing_request_final_deliveries_agreement_idx
on public.listing_request_final_deliveries(
  agreement_id,
  version_number desc
);

create index if not exists
listing_request_final_deliveries_creator_idx
on public.listing_request_final_deliveries(
  creator_user_id,
  created_at desc
);

create index if not exists
listing_request_final_deliveries_buyer_idx
on public.listing_request_final_deliveries(
  buyer_user_id,
  created_at desc
);

create unique index if not exists
listing_request_final_deliveries_version_idx
on public.listing_request_final_deliveries(
  agreement_id,
  version_number
);

create unique index if not exists
listing_request_final_deliveries_one_active_idx
on public.listing_request_final_deliveries(agreement_id)
where status in ('draft', 'submitted');

drop trigger if exists
listing_request_final_deliveries_set_updated_at
on public.listing_request_final_deliveries;

create trigger
listing_request_final_deliveries_set_updated_at
before update on public.listing_request_final_deliveries
for each row
execute function public.set_updated_at();

alter table public.listing_request_final_deliveries
enable row level security;

drop policy if exists
"delivery participants can read final deliveries"
on public.listing_request_final_deliveries;

create policy
"delivery participants can read final deliveries"
on public.listing_request_final_deliveries
for select
to authenticated
using (
  creator_user_id = auth.uid()

  or exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  )

  or (
    buyer_user_id = auth.uid()
    and submitted_at is not null
  )
);