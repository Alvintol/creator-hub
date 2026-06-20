create or replace function
public.enforce_final_delivery_milestone_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;

  latest_final_delivery_status text;

  milestone_payment_count integer := 0;
  unpaid_milestone_payment_count integer := 0;
begin
  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = new.agreement_id
    and listing_request_agreements.listing_request_id =
      new.listing_request_id
    and listing_request_agreements.status = 'buyer_accepted';

  if not found then
    raise exception
      'A buyer-accepted project agreement is required before final delivery can be created.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id = new.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'Final delivery can only be created for an accepted request.'
      using errcode = 'P0001';
  end if;

  if agreement_row.starting_payment_status not in (
    'paid',
    'not_required'
  ) then
    raise exception
      'Starting payment must be resolved before final delivery can be created.'
      using errcode = 'P0001';
  end if;

  select listing_request_final_deliveries.status
  into latest_final_delivery_status
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.listing_request_id =
      new.listing_request_id
    and listing_request_final_deliveries.agreement_id =
      new.agreement_id
  order by
    listing_request_final_deliveries.created_at desc,
    listing_request_final_deliveries.id desc
  limit 1;

  if latest_final_delivery_status is not null and
    latest_final_delivery_status not in (
      'revision_requested',
      'cancelled'
    ) then
    raise exception
      'A new final delivery can only be created after the previous delivery is revised or cancelled.'
      using errcode = 'P0001';
  end if;

  if agreement_row.payment_structure = 'milestone_payments' then
    select
      count(*)::integer,
      count(*) filter (
        where listing_request_payment_schedule_items.status <> 'paid'
      )::integer
    into
      milestone_payment_count,
      unpaid_milestone_payment_count
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.agreement_id =
        agreement_row.id
      and listing_request_payment_schedule_items.payment_timing =
        'due_at_milestone_approval';

    if milestone_payment_count = 0 then
      raise exception
        'Milestone payments must be configured before final delivery can be created.'
        using errcode = 'P0001';
    end if;

    if unpaid_milestone_payment_count > 0 then
      raise exception
        'All milestone payments must be confirmed before final delivery can be created.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;