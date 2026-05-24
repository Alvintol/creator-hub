create extension if not exists "pgcrypto";

create table if not exists public.listing_request_agreements (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,
  creator_user_id uuid not null,
  buyer_user_id uuid not null,

  version_number integer not null default 1 check (version_number >= 1),

  status text not null default 'draft' check (
    status in (
      'draft',
      'sent',
      'buyer_accepted',
      'buyer_declined',
      'superseded',
      'cancelled'
    )
  ),

  payment_structure text not null check (
    payment_structure in (
      'full_prepayment',
      'deposit_balance',
      'milestone_payments'
    )
  ),

  starting_payment_status text not null default 'payment_required' check (
    starting_payment_status in (
      'not_required',
      'payment_required',
      'paid'
    )
  ),

  currency text not null default 'cad' check (
    currency = lower(currency)
    and char_length(currency) = 3
  ),

  base_amount numeric(12, 2) not null default 0 check (base_amount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  deposit_amount numeric(12, 2) null check (
    deposit_amount is null
    or deposit_amount >= 0
  ),

  estimated_start_at timestamptz null,
  estimated_completion_at timestamptz not null,
  adjusted_estimated_completion_at timestamptz not null,

  late_delivery_grace_days integer not null default 7 check (
    late_delivery_grace_days >= 0
    and late_delivery_grace_days <= 60
  ),

  included_revision_count integer not null default 0 check (
    included_revision_count >= 0
    and included_revision_count <= 20
  ),

  minimum_update_rule text not null check (
    minimum_update_rule in (
      'single_progress_update',
      'weekly_updates'
    )
  ),

  first_update_due_days integer null check (
    first_update_due_days is null
    or (
      first_update_due_days >= 1
      and first_update_due_days <= 30
    )
  ),

  update_frequency_days integer null check (
    update_frequency_days is null
    or (
      update_frequency_days >= 1
      and update_frequency_days <= 30
    )
  ),

  scope_summary text not null check (
    char_length(btrim(scope_summary)) >= 10
    and char_length(btrim(scope_summary)) <= 4000
  ),

  included_deliverables text[] not null default '{}'::text[],

  additional_cost_policy text not null check (
    char_length(btrim(additional_cost_policy)) >= 10
    and char_length(btrim(additional_cost_policy)) <= 4000
  ),

  revision_policy text null check (
    revision_policy is null
    or char_length(btrim(revision_policy)) <= 4000
  ),

  update_schedule_summary text null check (
    update_schedule_summary is null
    or char_length(btrim(update_schedule_summary)) <= 4000
  ),

  sent_at timestamptz null,
  buyer_accepted_at timestamptz null,
  buyer_declined_at timestamptz null,
  superseded_at timestamptz null,
  cancelled_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (adjusted_estimated_completion_at >= estimated_completion_at),
  check (
    deposit_amount is null
    or deposit_amount <= total_amount
  )
);

create table if not exists public.listing_request_agreement_items (
  id uuid primary key default gen_random_uuid(),

  agreement_id uuid not null references public.listing_request_agreements(id) on delete cascade,

  title text not null check (
    char_length(btrim(title)) >= 2
    and char_length(btrim(title)) <= 160
  ),

  description text null check (
    description is null
    or char_length(btrim(description)) <= 2000
  ),

  item_type text not null check (
    item_type in (
      'included',
      'optional_addon',
      'required_payment_item',
      'milestone'
    )
  ),

  price_amount numeric(12, 2) null check (
    price_amount is null
    or price_amount >= 0
  ),

  timeline_impact_days integer null check (
    timeline_impact_days is null
    or (
      timeline_impact_days >= 0
      and timeline_impact_days <= 365
    )
  ),

  payment_timing text not null check (
    payment_timing in (
      'due_before_work_starts',
      'due_at_milestone_approval',
      'due_before_final_release',
      'due_on_change_order_acceptance',
      'included_no_extra_charge',
      'optional_not_selected'
    )
  ),

  is_required boolean not null default true,
  is_selected boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_request_payment_schedule_items (
  id uuid primary key default gen_random_uuid(),

  agreement_id uuid not null references public.listing_request_agreements(id) on delete cascade,

  title text not null check (
    char_length(btrim(title)) >= 2
    and char_length(btrim(title)) <= 160
  ),

  description text null check (
    description is null
    or char_length(btrim(description)) <= 2000
  ),

  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'cad' check (
    currency = lower(currency)
    and char_length(currency) = 3
  ),

  payment_timing text not null check (
    payment_timing in (
      'due_before_work_starts',
      'due_at_milestone_approval',
      'due_before_final_release',
      'due_on_change_order_acceptance'
    )
  ),

  status text not null default 'pending' check (
    status in (
      'pending',
      'payment_required',
      'paid',
      'waived',
      'cancelled'
    )
  ),

  due_at timestamptz null,
  paid_at timestamptz null,

  sort_order integer not null default 0 check (sort_order >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_request_timeline_holds (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,
  agreement_id uuid null references public.listing_request_agreements(id) on delete cascade,
  payment_schedule_item_id uuid null references public.listing_request_payment_schedule_items(id) on delete set null,

  reason text not null check (
    reason in (
      'agreement_acceptance_pending',
      'starting_payment_pending',
      'milestone_approval_pending',
      'milestone_payment_pending',
      'change_order_response_pending',
      'balance_payment_pending'
    )
  ),

  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  rounded_extension_days integer not null default 0 check (
    rounded_extension_days >= 0
    and rounded_extension_days <= 365
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    ended_at is null
    or ended_at >= started_at
  )
);

create index if not exists listing_request_agreements_request_idx
on public.listing_request_agreements(listing_request_id);

create index if not exists listing_request_agreements_creator_idx
on public.listing_request_agreements(creator_user_id);

create index if not exists listing_request_agreements_buyer_idx
on public.listing_request_agreements(buyer_user_id);

create unique index if not exists listing_request_agreements_one_active_version_idx
on public.listing_request_agreements(listing_request_id)
where status in ('draft', 'sent', 'buyer_accepted');

create unique index if not exists listing_request_agreements_request_version_idx
on public.listing_request_agreements(listing_request_id, version_number);

create index if not exists listing_request_agreement_items_agreement_idx
on public.listing_request_agreement_items(agreement_id);

create index if not exists listing_request_payment_schedule_items_agreement_idx
on public.listing_request_payment_schedule_items(agreement_id);

create index if not exists listing_request_timeline_holds_request_idx
on public.listing_request_timeline_holds(listing_request_id);

create index if not exists listing_request_timeline_holds_agreement_idx
on public.listing_request_timeline_holds(agreement_id);

create unique index if not exists listing_request_timeline_holds_one_active_reason_idx
on public.listing_request_timeline_holds(listing_request_id, reason)
where ended_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listing_request_agreements_set_updated_at
on public.listing_request_agreements;

create trigger listing_request_agreements_set_updated_at
before update on public.listing_request_agreements
for each row
execute function public.set_updated_at();

drop trigger if exists listing_request_agreement_items_set_updated_at
on public.listing_request_agreement_items;

create trigger listing_request_agreement_items_set_updated_at
before update on public.listing_request_agreement_items
for each row
execute function public.set_updated_at();

drop trigger if exists listing_request_payment_schedule_items_set_updated_at
on public.listing_request_payment_schedule_items;

create trigger listing_request_payment_schedule_items_set_updated_at
before update on public.listing_request_payment_schedule_items
for each row
execute function public.set_updated_at();

drop trigger if exists listing_request_timeline_holds_set_updated_at
on public.listing_request_timeline_holds;

create trigger listing_request_timeline_holds_set_updated_at
before update on public.listing_request_timeline_holds
for each row
execute function public.set_updated_at();

create or replace function public.set_listing_request_timeline_hold_extension_days()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ended_at is null then
    new.rounded_extension_days = 0;
    return new;
  end if;

  new.rounded_extension_days = greatest(
    0,
    ceil(extract(epoch from (new.ended_at - new.started_at)) / 86400.0)::integer
  );

  return new;
end;
$$;

drop trigger if exists listing_request_timeline_holds_set_extension_days
on public.listing_request_timeline_holds;

create trigger listing_request_timeline_holds_set_extension_days
before insert or update of started_at, ended_at
on public.listing_request_timeline_holds
for each row
execute function public.set_listing_request_timeline_hold_extension_days();

create or replace function public.refresh_listing_request_agreement_adjusted_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_agreement_id uuid;
  extension_days integer;
begin
  target_agreement_id := coalesce(new.agreement_id, old.agreement_id);

  if target_agreement_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(rounded_extension_days), 0)
  into extension_days
  from public.listing_request_timeline_holds
  where agreement_id = target_agreement_id
    and ended_at is not null;

  update public.listing_request_agreements
  set adjusted_estimated_completion_at =
    estimated_completion_at + make_interval(days => extension_days)
  where id = target_agreement_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists listing_request_timeline_holds_refresh_agreement_completion_insert
on public.listing_request_timeline_holds;

create trigger listing_request_timeline_holds_refresh_agreement_completion_insert
after insert on public.listing_request_timeline_holds
for each row
execute function public.refresh_listing_request_agreement_adjusted_completion();

drop trigger if exists listing_request_timeline_holds_refresh_agreement_completion_update
on public.listing_request_timeline_holds;

create trigger listing_request_timeline_holds_refresh_agreement_completion_update
after update of ended_at, rounded_extension_days, agreement_id
on public.listing_request_timeline_holds
for each row
execute function public.refresh_listing_request_agreement_adjusted_completion();

alter table public.listing_request_agreements enable row level security;
alter table public.listing_request_agreement_items enable row level security;
alter table public.listing_request_payment_schedule_items enable row level security;
alter table public.listing_request_timeline_holds enable row level security;

drop policy if exists "agreement participants can read agreements"
on public.listing_request_agreements;

create policy "agreement participants can read agreements"
on public.listing_request_agreements
for select
to authenticated
using (
  auth.uid() = buyer_user_id
  or auth.uid() = creator_user_id
  or exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  )
);

drop policy if exists "agreement participants can read agreement items"
on public.listing_request_agreement_items;

create policy "agreement participants can read agreement items"
on public.listing_request_agreement_items
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.id = listing_request_agreement_items.agreement_id
      and (
        listing_request_agreements.buyer_user_id = auth.uid()
        or listing_request_agreements.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "agreement participants can read payment schedule items"
on public.listing_request_payment_schedule_items;

create policy "agreement participants can read payment schedule items"
on public.listing_request_payment_schedule_items
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.id = listing_request_payment_schedule_items.agreement_id
      and (
        listing_request_agreements.buyer_user_id = auth.uid()
        or listing_request_agreements.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "request participants can read timeline holds"
on public.listing_request_timeline_holds;

create policy "request participants can read timeline holds"
on public.listing_request_timeline_holds
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_requests
    where listing_requests.id = listing_request_timeline_holds.listing_request_id
      and (
        listing_requests.buyer_user_id = auth.uid()
        or listing_requests.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
      )
  )
);