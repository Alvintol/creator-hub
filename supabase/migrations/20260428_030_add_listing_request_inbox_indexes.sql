create index if not exists listing_requests_creator_status_created_at_idx on public.listing_requests using btree (
  creator_user_id,
  status,
  created_at desc
);

create index if not exists listing_requests_buyer_status_created_at_idx on public.listing_requests using btree (
  buyer_user_id,
  status,
  created_at desc
);