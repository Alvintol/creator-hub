create or replace function
public.enforce_final_delivery_approval_milestone_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;

  milestone_payment_count integer := 0;
  unpaid_milestone_payment_count integer := 0;
  outstanding_final_balance_count integer := 0;
  active_final_balance_hold_count integer := 0;
begin
  if new.status <> 'buyer_approved' then
    return new;
  end if;

  if old.status = 'buyer_approved' then
    return new;
  end if;

  if old.status <> 'submitted' then
    raise exception
      'Only submitted final deliveries can be approved.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = new.agreement_id
    and listing_request_agreements.status = 'buyer_accepted';

  if not found then
    raise exception
      'A buyer-accepted project agreement is required before final delivery can be approved.'
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
        'Milestone payments must be configured before final delivery can be approved.'
        using errcode = 'P0001';
    end if;

    if unpaid_milestone_payment_count > 0 then
      raise exception
        'All milestone payments must be confirmed before final delivery can be approved.'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*)::integer
  into outstanding_final_balance_count
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_final_release'
    and listing_request_payment_schedule_items.amount > 0
    and listing_request_payment_schedule_items.status in (
      'pending',
      'payment_required'
    );

  if outstanding_final_balance_count > 0 then
    raise exception
      'The final balance must be confirmed as paid before final delivery can be approved.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into active_final_balance_hold_count
  from public.listing_request_timeline_holds
  where listing_request_timeline_holds.listing_request_id =
      new.listing_request_id
    and listing_request_timeline_holds.agreement_id =
      agreement_row.id
    and listing_request_timeline_holds.reason =
      'balance_payment_pending'
    and listing_request_timeline_holds.ended_at is null;

  if active_final_balance_hold_count > 0 then
    raise exception
      'The final balance payment is still awaiting confirmation.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;