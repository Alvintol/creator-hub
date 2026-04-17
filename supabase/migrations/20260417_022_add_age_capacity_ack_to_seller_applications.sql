alter table public.seller_applications
add column if not exists agreed_to_age_and_capacity boolean not null default false;