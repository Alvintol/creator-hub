alter table public.listing_requests
add column if not exists completed_at timestamptz null;

alter table public.listing_requests
add column if not exists completed_by_user_id uuid null;

alter table public.listing_requests
drop constraint if exists listing_requests_status_check;

alter table public.listing_requests
add constraint listing_requests_status_check
check (
  status in (
    'submitted',
    'accepted',
    'completed',
    'declined',
    'archived'
  )
);

alter table public.listing_requests
drop constraint if exists listing_requests_completed_metadata_check;

alter table public.listing_requests
add constraint listing_requests_completed_metadata_check
check (
  (
    status = 'completed'
    and completed_at is not null
    and completed_by_user_id is not null
  )
  or
  (
    status <> 'completed'
    and completed_at is null
    and completed_by_user_id is null
  )
);

create index if not exists
listing_requests_completed_at_idx
on public.listing_requests(completed_at desc)
where status = 'completed';

create or replace function
public.complete_listing_request_after_final_delivery_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  completion_time timestamptz;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status <> 'buyer_approved' then
    return new;
  end if;

  completion_time := coalesce(
    new.buyer_approved_at,
    now()
  );

  update public.listing_requests
  set
    status = 'completed',
    completed_at = completion_time,
    completed_by_user_id = new.buyer_user_id
  where listing_requests.id =
      new.listing_request_id
    and listing_requests.buyer_user_id =
      new.buyer_user_id
    and listing_requests.creator_user_id =
      new.creator_user_id
    and listing_requests.status = 'accepted';

  if not found then
    raise exception
      'The accepted request could not be completed after final-delivery approval.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists
listing_request_final_deliveries_complete_request
on public.listing_request_final_deliveries;

create trigger
listing_request_final_deliveries_complete_request
after update of status
on public.listing_request_final_deliveries
for each row
when (
  old.status is distinct from new.status
  and new.status = 'buyer_approved'
)
execute function
public.complete_listing_request_after_final_delivery_approval();