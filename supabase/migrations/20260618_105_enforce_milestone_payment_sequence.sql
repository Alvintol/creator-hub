create or replace function
public.enforce_listing_request_milestone_payment_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_unpaid_milestone_count integer := 0;
begin
  if new.status <> 'paid' then
    return new;
  end if;

  if old.status = 'paid' then
    return new;
  end if;

  select count(*)::integer
  into prior_unpaid_milestone_count
  from public.listing_request_milestones
  where listing_request_milestones.listing_request_id =
      new.listing_request_id
    and listing_request_milestones.agreement_id =
      new.agreement_id
    and listing_request_milestones.sort_order <
      new.sort_order
    and listing_request_milestones.status <> 'paid';

  if prior_unpaid_milestone_count > 0 then
    raise exception
      'Previous milestones must be paid before this milestone payment can be confirmed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_listing_request_milestone_payment_sequence
on public.listing_request_milestones;

create trigger
  enforce_listing_request_milestone_payment_sequence
before update of status
on public.listing_request_milestones
for each row
execute function
  public.enforce_listing_request_milestone_payment_sequence();