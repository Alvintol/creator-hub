create table public.listing_requests (
  id uuid not null default gen_random_uuid (),
  listing_id uuid not null,
  buyer_user_id uuid not null,
  creator_user_id uuid not null,
  status text not null default 'submitted'::text,
  message text not null,
  listing_snapshot jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint listing_requests_pkey primary key (id),
  constraint listing_requests_listing_id_fkey
    foreign key (listing_id) references public.listings (id),
  constraint listing_requests_buyer_user_id_fkey
    foreign key (buyer_user_id) references auth.users (id),
  constraint listing_requests_creator_user_id_fkey
    foreign key (creator_user_id) references auth.users (id),
  constraint listing_requests_status_check
    check (
      status = any (
        array['submitted'::text, 'archived'::text]
      )
    ),
  constraint listing_requests_message_check
    check (
      (char_length(message) >= 10)
      and (char_length(message) <= 2000)
    ),
  constraint listing_requests_buyer_creator_check
    check (buyer_user_id <> creator_user_id)
) tablespace pg_default;

create index if not exists listing_requests_listing_id_idx
  on public.listing_requests using btree (listing_id) tablespace pg_default;

create index if not exists listing_requests_buyer_user_id_idx
  on public.listing_requests using btree (buyer_user_id) tablespace pg_default;

create index if not exists listing_requests_creator_user_id_idx
  on public.listing_requests using btree (creator_user_id) tablespace pg_default;

create index if not exists listing_requests_status_idx
  on public.listing_requests using btree (status) tablespace pg_default;

alter table public.listing_requests enable row level security;

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
  )
);

create policy "listing requests buyer read own"
on public.listing_requests
for select
to authenticated
using (
  auth.uid() = buyer_user_id
);

create policy "listing requests creator read own"
on public.listing_requests
for select
to authenticated
using (
  auth.uid() = creator_user_id
);

create policy "listing requests admin read"
on public.listing_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
      and admin_roles.role = 'admin'
  )
);

create trigger listing_requests_set_updated_at
before update on public.listing_requests
for each row
execute function set_updated_at();