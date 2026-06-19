create or replace function
public.enforce_listing_request_milestone_submission_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row public.listing_request_milestones%rowtype;

  prior_unpaid_milestone_count integer := 0;
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
  into prior_unpaid_milestone_count
  from public.listing_request_milestones
  where listing_request_milestones.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_milestones.agreement_id =
      milestone_row.agreement_id
    and listing_request_milestones.sort_order <
      milestone_row.sort_order
    and listing_request_milestones.status <> 'paid';

  if prior_unpaid_milestone_count > 0 then
    raise exception
      'Previous milestones must be paid before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_listing_request_milestone_submission_sequence
on public.listing_request_milestone_submissions;

create trigger
  enforce_listing_request_milestone_submission_sequence
before insert
on public.listing_request_milestone_submissions
for each row
execute function
  public.enforce_listing_request_milestone_submission_sequence();