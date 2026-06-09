alter table public.listing_request_payment_schedule_items
add column if not exists change_order_id uuid null
references public.listing_request_change_orders(id)
on delete set null;

create unique index if not exists
listing_request_payment_schedule_items_change_order_idx
on public.listing_request_payment_schedule_items(change_order_id)
where change_order_id is not null;

alter table public.listing_request_timeline_holds
drop constraint if exists listing_request_timeline_holds_reason_check;

alter table public.listing_request_timeline_holds
add constraint listing_request_timeline_holds_reason_check
check (
  reason in (
    'agreement_acceptance_pending',
    'starting_payment_pending',
    'milestone_approval_pending',
    'milestone_payment_pending',
    'change_order_response_pending',
    'change_order_payment_pending',
    'balance_payment_pending'
  )
);

create or replace function
public.create_listing_request_change_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
  payment_item_id uuid;
  next_sort_order integer;
  payment_required_at timestamptz;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status <> 'buyer_accepted'
    or not new.changes_price
    or new.price_delta <= 0 then
    return new;
  end if;

  if exists (
    select 1
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.change_order_id =
      new.id
  ) then
    return new;
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = new.agreement_id
    and listing_request_agreements.listing_request_id =
      new.listing_request_id
    and listing_request_agreements.status =
      'buyer_accepted';

  if not found then
    raise exception
      'The accepted agreement could not be found for the change-order payment.'
      using errcode = 'P0001';
  end if;

  select coalesce(
    max(
      listing_request_payment_schedule_items.sort_order
    ),
    -1
  ) + 1
  into next_sort_order
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
    agreement_row.id;

  payment_required_at := coalesce(
    new.buyer_accepted_at,
    now()
  );

  insert into public.listing_request_payment_schedule_items (
    agreement_id,
    change_order_id,
    title,
    description,
    amount,
    currency,
    payment_timing,
    status,
    due_at,
    paid_at,
    sort_order
  )
  values (
    agreement_row.id,
    new.id,
    left(
      format(
        'Change order: %s',
        new.title
      ),
      160
    ),
    left(
      format(
        'Additional payment required after accepting change order version %s.',
        new.version_number
      ),
      2000
    ),
    new.price_delta,
    agreement_row.currency,
    'due_on_change_order_acceptance',
    'payment_required',
    payment_required_at,
    null,
    next_sort_order
  )
  returning id
  into payment_item_id;

  insert into public.listing_request_timeline_holds (
    listing_request_id,
    agreement_id,
    payment_schedule_item_id,
    reason,
    started_at
  )
  values (
    new.listing_request_id,
    new.agreement_id,
    payment_item_id,
    'change_order_payment_pending',
    payment_required_at
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists
listing_request_change_orders_create_payment
on public.listing_request_change_orders;

create trigger
listing_request_change_orders_create_payment
after update of status
on public.listing_request_change_orders
for each row
when (
  old.status is distinct from new.status
  and new.status = 'buyer_accepted'
)
execute function
public.create_listing_request_change_order_payment();