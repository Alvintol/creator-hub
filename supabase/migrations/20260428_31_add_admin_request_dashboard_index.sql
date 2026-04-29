create index if not exists listing_requests_status_created_at_idx
on public.listing_requests using btree (
  status,
  created_at desc
);