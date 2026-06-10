alter table public.listing_requests
add column if not exists completed_at timestamptz null,
add column if not exists completed_by_user_id uuid null;

alter table public.listing_requests
drop constraint if exists listing_requests_status_check;

alter table public.listing_requests
add constraint listing_requests_status_check
check (
  status = any (
    array[
      'submitted'::text,
      'accepted'::text,
      'declined'::text,
      'archived'::text,
      'completed'::text
    ]
  )
);

alter table public.listing_requests
drop constraint if exists listing_requests_completion_metadata_check;

alter table public.listing_requests
add constraint listing_requests_completion_metadata_check
check (
  status <> 'completed'
  or (
    completed_at is not null
    and completed_by_user_id is not null
  )
);

create or replace function
public.protect_listing_request_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'completed' then
    if new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at
      or new.completed_by_user_id
        is distinct from old.completed_by_user_id then
      raise exception
        'A completed listing request cannot be reopened or have its completion metadata changed.'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  if new.status = 'completed' then
    if old.status <> 'accepted' then
      raise exception
        'Only an accepted listing request can be completed.'
        using errcode = 'P0001';
    end if;

    if auth.uid() is null
      or auth.uid() <> new.buyer_user_id then
      raise exception
        'Only the buyer can complete this listing request through final-delivery approval.'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.listing_request_final_deliveries
      where listing_request_final_deliveries.listing_request_id =
          new.id
        and listing_request_final_deliveries.agreement_id
          is not null
        and listing_request_final_deliveries.buyer_user_id =
          new.buyer_user_id
        and listing_request_final_deliveries.status =
          'buyer_approved'
        and listing_request_final_deliveries.buyer_approved_at
          is not null
    ) then
      raise exception
        'An approved final delivery is required before completing this listing request.'
        using errcode = 'P0001';
    end if;

    new.completed_at :=
      coalesce(new.completed_at, now());

    new.completed_by_user_id :=
      coalesce(
        new.completed_by_user_id,
        auth.uid()
      );

    return new;
  end if;

  new.completed_at := null;
  new.completed_by_user_id := null;

  return new;
end;
$$;

drop trigger if exists
listing_requests_protect_completion
on public.listing_requests;

create trigger
listing_requests_protect_completion
before update of
  status,
  completed_at,
  completed_by_user_id
on public.listing_requests
for each row
execute function
public.protect_listing_request_completion();

create or replace function
public.complete_listing_request_after_final_delivery_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request_count integer := 0;
begin
  if old.status is not distinct from new.status
    or new.status <> 'buyer_approved' then
    return new;
  end if;

  update public.listing_requests
  set
    status = 'completed',
    completed_at = coalesce(
      completed_at,
      new.buyer_approved_at,
      now()
    ),
    completed_by_user_id = coalesce(
      completed_by_user_id,
      new.buyer_user_id
    )
  where listing_requests.id =
      new.listing_request_id
    and listing_requests.buyer_user_id =
      new.buyer_user_id
    and listing_requests.creator_user_id =
      new.creator_user_id
    and listing_requests.status = 'accepted';

  get diagnostics updated_request_count = row_count;

  if updated_request_count <> 1 then
    raise exception
      'The accepted listing request could not be completed after final-delivery approval.'
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