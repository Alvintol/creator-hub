create or replace function
public.enforce_listing_request_milestone_submission_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row public.listing_request_milestones%rowtype;

  prior_incomplete_milestone_count integer := 0;
begin
  select *
  into milestone_row
  from public.listing_request_milestones
  where listing_request_milestones.id = new.milestone_id
  for update;

  if not found then
    raise exception
      'Milestone could not be found.'
      using errcode = 'P0001';
  end if;

  if milestone_row.status not in (
    'pending',
    'revision_requested'
  ) then
    raise exception
      'This milestone is not ready for submission.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into prior_incomplete_milestone_count
  from public.listing_request_milestones
  where listing_request_milestones.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_milestones.agreement_id =
      milestone_row.agreement_id
    and listing_request_milestones.sort_order <
      milestone_row.sort_order
    and listing_request_milestones.status not in (
      'paid',
      'cancelled'
    );

  if prior_incomplete_milestone_count > 0 then
    raise exception
      'Previous milestones must be completed before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function
public.enforce_listing_request_milestone_payment_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_incomplete_milestone_count integer := 0;
begin
  if new.status <> 'paid' then
    return new;
  end if;

  if old.status = 'paid' then
    return new;
  end if;

  select count(*)::integer
  into prior_incomplete_milestone_count
  from public.listing_request_milestones
  where listing_request_milestones.listing_request_id =
      new.listing_request_id
    and listing_request_milestones.agreement_id =
      new.agreement_id
    and listing_request_milestones.sort_order <
      new.sort_order
    and listing_request_milestones.status not in (
      'paid',
      'cancelled'
    );

  if prior_incomplete_milestone_count > 0 then
    raise exception
      'Previous milestones must be completed before this milestone payment can be confirmed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function
public.enforce_listing_request_milestone_buyer_response_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_incomplete_milestone_count integer := 0;
begin
  if new.status not in (
    'buyer_approved',
    'payment_required'
  ) then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  select count(*)::integer
  into prior_incomplete_milestone_count
  from public.listing_request_milestones
  where listing_request_milestones.listing_request_id =
      new.listing_request_id
    and listing_request_milestones.agreement_id =
      new.agreement_id
    and listing_request_milestones.sort_order <
      new.sort_order
    and listing_request_milestones.status not in (
      'paid',
      'cancelled'
    );

  if prior_incomplete_milestone_count > 0 then
    raise exception
      'Previous milestones must be completed before this milestone can be approved.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_listing_request_milestone_buyer_response_sequence
on public.listing_request_milestones;

create trigger
  enforce_listing_request_milestone_buyer_response_sequence
before update of status
on public.listing_request_milestones
for each row
execute function
  public.enforce_listing_request_milestone_buyer_response_sequence();