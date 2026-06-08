create table if not exists public.listing_request_change_orders (
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
        'sent',
        'buyer_accepted',
        'buyer_declined',
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

  changes_scope boolean not null default false,
  changes_price boolean not null default false,
  changes_timeline boolean not null default false,
  changes_deliverables boolean not null default false,
  changes_payment_schedule boolean not null default false,
  changes_milestones boolean not null default false,

  price_delta numeric(12, 2) not null default 0,

  revised_total_amount numeric(12, 2) null
    check (
      revised_total_amount is null
      or revised_total_amount >= 0
    ),

  timeline_delta_days integer not null default 0
    check (
      timeline_delta_days >= -365
      and timeline_delta_days <= 365
    ),

  revised_completion_at timestamptz null,

  before_snapshot jsonb not null
    check (jsonb_typeof(before_snapshot) = 'object'),

  proposed_snapshot jsonb not null
    check (jsonb_typeof(proposed_snapshot) = 'object'),

  buyer_response_reason text null
    check (
      buyer_response_reason is null
      or char_length(btrim(buyer_response_reason)) <= 2000
    ),

  sent_at timestamptz null,
  buyer_accepted_at timestamptz null,
  buyer_declined_at timestamptz null,
  cancelled_at timestamptz null,
  superseded_at timestamptz null,
  applied_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    changes_scope
    or changes_price
    or changes_timeline
    or changes_deliverables
    or changes_payment_schedule
    or changes_milestones
  ),

  check (
    not changes_price
    or revised_total_amount is not null
  ),

  check (
    not changes_timeline
    or revised_completion_at is not null
  )
);

create index if not exists listing_request_change_orders_request_idx
on public.listing_request_change_orders(
  listing_request_id,
  created_at desc
);

create index if not exists listing_request_change_orders_agreement_idx
on public.listing_request_change_orders(
  agreement_id,
  version_number desc
);

create index if not exists listing_request_change_orders_creator_idx
on public.listing_request_change_orders(
  creator_user_id,
  created_at desc
);

create index if not exists listing_request_change_orders_buyer_idx
on public.listing_request_change_orders(
  buyer_user_id,
  created_at desc
);

create unique index if not exists listing_request_change_orders_version_idx
on public.listing_request_change_orders(
  agreement_id,
  version_number
);

create unique index if not exists listing_request_change_orders_one_pending_idx
on public.listing_request_change_orders(agreement_id)
where status in ('draft', 'sent');

drop trigger if exists listing_request_change_orders_set_updated_at
on public.listing_request_change_orders;

create trigger listing_request_change_orders_set_updated_at
before update on public.listing_request_change_orders
for each row
execute function public.set_updated_at();

alter table public.listing_request_change_orders
enable row level security;

drop policy if exists "change order participants can read change orders"
on public.listing_request_change_orders;

create policy "change order participants can read change orders"
on public.listing_request_change_orders
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
    and sent_at is not null
  )
);