create unique index if not exists listing_requests_one_active_request_per_buyer_listing_idx
on public.listing_requests (buyer_user_id, listing_id)
where status in ('submitted', 'accepted');