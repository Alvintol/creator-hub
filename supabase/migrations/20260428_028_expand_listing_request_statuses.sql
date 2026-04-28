alter table
  public.listing_requests drop constraint if exists listing_requests_status_check;

alter table
  public.listing_requests
add
  constraint listing_requests_status_check check (
    status = any (
      array [
      'submitted'::text,
      'accepted'::text,
      'declined'::text,
      'archived'::text
    ]
    )
  );

drop policy if exists "listing requests creator update own" on public.listing_requests;

create policy "listing requests creator update own" on public.listing_requests for
update
  to authenticated using (auth.uid() = creator_user_id) with check (auth.uid() = creator_user_id);