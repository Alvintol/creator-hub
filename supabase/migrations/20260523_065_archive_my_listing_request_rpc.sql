-- Allows buyers to archive/cancel their own submitted listing requests.
-- This avoids opening broad buyer UPDATE permissions on listing_requests.

create or replace function public.archive_my_listing_request(
  p_request_id uuid
)
returns table (
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to archive a request.'
      using errcode = '42501';
  end if;

  return query
  update public.listing_requests
  set
    status = 'archived',
    updated_at = now()
  where listing_requests.id = p_request_id
    and listing_requests.buyer_user_id = auth.uid()
    and listing_requests.status = 'submitted'
  returning
    listing_requests.id,
    listing_requests.status;

  if not found then
    raise exception 'This request could not be archived.'
      using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.archive_my_listing_request(uuid)
to authenticated;