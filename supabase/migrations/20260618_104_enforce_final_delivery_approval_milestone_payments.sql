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
begin
  if new.status <> 'buyer_approved' then
    return new;
  end if;

  if old.status = 'buyer_approved' then
    return new;
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = new.agreement_id;

  if not found then
    raise exception
      'Project agreement could not be found.'
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

  return new;
end;
$$;

drop trigger if exists
  enforce_final_delivery_approval_milestone_payments
on public.listing_request_final_deliveries;

create trigger
  enforce_final_delivery_approval_milestone_payments
before update of status
on public.listing_request_final_deliveries
for each row
execute function
  public.enforce_final_delivery_approval_milestone_payments();