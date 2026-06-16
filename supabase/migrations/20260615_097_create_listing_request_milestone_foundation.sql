create table if not exists public.listing_request_milestones (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null
    references public.listing_requests(id)
    on delete cascade,

  agreement_id uuid not null
    references public.listing_request_agreements(id)
    on delete cascade,

  agreement_item_id uuid not null
    references public.listing_request_agreement_items(id)
    on delete cascade,

  payment_schedule_item_id uuid not null
    references public.listing_request_payment_schedule_items(id)
    on delete cascade,

  creator_user_id uuid not null,
  buyer_user_id uuid not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'submitted',
        'revision_requested',
        'buyer_approved',
        'payment_required',
        'paid',
        'cancelled'
      )
    ),

  title text not null
    check (
      char_length(btrim(title)) >= 3
      and char_length(btrim(title)) <= 160
    ),

  description text null
    check (
      description is null
      or char_length(btrim(description)) <= 2000
    ),

  amount numeric(12, 2) not null
    check (amount > 0),

  currency text not null
    check (char_length(currency) = 3),

  sort_order integer not null default 0
    check (sort_order >= 0),

  submission_version integer not null default 0
    check (submission_version >= 0),

  latest_submitted_at timestamptz null,
  latest_revision_requested_at timestamptz null,
  buyer_approved_at timestamptz null,
  payment_required_at timestamptz null,
  paid_at timestamptz null,
  cancelled_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (agreement_item_id),
  unique (payment_schedule_item_id),
  unique (agreement_id, sort_order)
);

create index if not exists
listing_request_milestones_request_idx
on public.listing_request_milestones(
  listing_request_id,
  sort_order
);

create index if not exists
listing_request_milestones_agreement_idx
on public.listing_request_milestones(
  agreement_id,
  sort_order
);

create index if not exists
listing_request_milestones_creator_idx
on public.listing_request_milestones(
  creator_user_id,
  status
);

create index if not exists
listing_request_milestones_buyer_idx
on public.listing_request_milestones(
  buyer_user_id,
  status
);

drop trigger if exists
listing_request_milestones_set_updated_at
on public.listing_request_milestones;

create trigger
listing_request_milestones_set_updated_at
before update
on public.listing_request_milestones
for each row
execute function public.set_updated_at();

alter table public.listing_request_milestones
enable row level security;

drop policy if exists
"milestone participants can read milestones"
on public.listing_request_milestones;

create policy
"milestone participants can read milestones"
on public.listing_request_milestones
for select
to authenticated
using (
  creator_user_id = auth.uid()

  or exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id =
      auth.uid()
  )

  or (
    buyer_user_id = auth.uid()

    and exists (
      select 1
      from public.listing_request_agreements
      where listing_request_agreements.id =
          listing_request_milestones.agreement_id
        and listing_request_agreements.sent_at
          is not null
    )
  )
);

create or replace function
public.create_listing_request_milestone_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_item_row
    public.listing_request_agreement_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;
begin
  if new.payment_timing <>
    'due_at_milestone_approval' then
    return new;
  end if;

  if new.agreement_item_id is null then
    raise exception
      'A milestone payment must reference an agreement item.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_item_row
  from public.listing_request_agreement_items
  where listing_request_agreement_items.id =
      new.agreement_item_id
    and listing_request_agreement_items.agreement_id =
      new.agreement_id;

  if not found then
    raise exception
      'The milestone agreement item could not be found.'
      using errcode = 'P0001';
  end if;

  if agreement_item_row.item_type <>
    'milestone' then
    raise exception
      'A milestone payment must reference a milestone agreement item.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
    new.agreement_id;

  if not found then
    raise exception
      'The milestone agreement could not be found.'
      using errcode = 'P0001';
  end if;

  insert into public.listing_request_milestones (
    listing_request_id,
    agreement_id,
    agreement_item_id,
    payment_schedule_item_id,
    creator_user_id,
    buyer_user_id,
    status,
    title,
    description,
    amount,
    currency,
    sort_order
  )
  values (
    agreement_row.listing_request_id,
    agreement_row.id,
    agreement_item_row.id,
    new.id,
    agreement_row.creator_user_id,
    agreement_row.buyer_user_id,
    case
      when new.status = 'payment_required'
        then 'payment_required'
      when new.status = 'paid'
        then 'paid'
      when new.status = 'cancelled'
        then 'cancelled'
      else 'pending'
    end,
    agreement_item_row.title,
    agreement_item_row.description,
    new.amount,
    lower(new.currency),
    new.sort_order
  )
  on conflict (payment_schedule_item_id)
  do nothing;

  return new;
end;
$$;

drop trigger if exists
listing_request_payment_schedule_create_milestone
on public.listing_request_payment_schedule_items;

create trigger
listing_request_payment_schedule_create_milestone
after insert
on public.listing_request_payment_schedule_items
for each row
when (
  new.payment_timing =
    'due_at_milestone_approval'
)
execute function
public.create_listing_request_milestone_from_payment();

-- Backfill linked milestone payments created before this migration.
insert into public.listing_request_milestones (
  listing_request_id,
  agreement_id,
  agreement_item_id,
  payment_schedule_item_id,
  creator_user_id,
  buyer_user_id,
  status,
  title,
  description,
  amount,
  currency,
  sort_order,
  payment_required_at,
  paid_at,
  cancelled_at
)
select
  agreement.listing_request_id,
  agreement.id,
  agreement_item.id,
  payment_item.id,
  agreement.creator_user_id,
  agreement.buyer_user_id,

  case
    when payment_item.status =
      'payment_required'
      then 'payment_required'
    when payment_item.status = 'paid'
      then 'paid'
    when payment_item.status = 'cancelled'
      then 'cancelled'
    else 'pending'
  end,

  agreement_item.title,
  agreement_item.description,
  payment_item.amount,
  lower(payment_item.currency),
  payment_item.sort_order,

  case
    when payment_item.status =
      'payment_required'
      then payment_item.due_at
    else null
  end,

  payment_item.paid_at,

  case
    when payment_item.status = 'cancelled'
      then payment_item.updated_at
    else null
  end

from public.listing_request_payment_schedule_items
  as payment_item

inner join public.listing_request_agreement_items
  as agreement_item
  on agreement_item.id =
    payment_item.agreement_item_id
  and agreement_item.agreement_id =
    payment_item.agreement_id

inner join public.listing_request_agreements
  as agreement
  on agreement.id =
    payment_item.agreement_id

where payment_item.payment_timing =
    'due_at_milestone_approval'
  and agreement_item.item_type =
    'milestone'

on conflict (payment_schedule_item_id)
do nothing;