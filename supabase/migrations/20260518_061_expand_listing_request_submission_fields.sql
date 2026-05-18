alter table public.listing_requests
  add column if not exists request_title text null,
  add column if not exists request_details text null,
  add column if not exists requested_timeline text null,
  add column if not exists budget_amount numeric(12, 2) null,
  add column if not exists reference_links text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'listing_requests_request_title_check'
  ) then
    alter table public.listing_requests
      add constraint listing_requests_request_title_check
      check (
        request_title is null
        or (
          char_length(btrim(request_title)) >= 3
          and char_length(btrim(request_title)) <= 120
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listing_requests_request_details_check'
  ) then
    alter table public.listing_requests
      add constraint listing_requests_request_details_check
      check (
        request_details is null
        or (
          char_length(btrim(request_details)) >= 10
          and char_length(btrim(request_details)) <= 2000
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listing_requests_requested_timeline_check'
  ) then
    alter table public.listing_requests
      add constraint listing_requests_requested_timeline_check
      check (
        requested_timeline is null
        or char_length(btrim(requested_timeline)) <= 160
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listing_requests_budget_amount_check'
  ) then
    alter table public.listing_requests
      add constraint listing_requests_budget_amount_check
      check (
        budget_amount is null
        or (
          budget_amount >= 0
          and budget_amount <= 999999.99
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listing_requests_reference_links_check'
  ) then
    alter table public.listing_requests
      add constraint listing_requests_reference_links_check
      check (
        array_length(reference_links, 1) is null
        or array_length(reference_links, 1) <= 5
      );
  end if;
end $$;

drop policy if exists "listing requests buyer insert" on public.listing_requests;

create policy "listing requests buyer insert"
on public.listing_requests
for insert
to authenticated
with check (
  auth.uid() = buyer_user_id
  and buyer_user_id <> creator_user_id
  and exists (
    select 1
    from public.listings
    where listings.id = listing_requests.listing_id
      and listings.user_id = listing_requests.creator_user_id
      and listings.status = 'published'::text
      and listings.is_active = true
      and listings.fulfilment_mode = 'request'::text
      and listings.admin_hidden_at is null
  )
);