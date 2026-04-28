alter table
  public.listing_requests
add
  column creator_status_reason text null;

alter table
  public.listing_requests drop constraint if exists listing_requests_creator_status_reason_check;

alter table
  public.listing_requests
add
  constraint listing_requests_creator_status_reason_check check (
    creator_status_reason is null
    or (
      char_length(btrim(creator_status_reason)) >= 10
      and char_length(btrim(creator_status_reason)) <= 1000
    )
  );