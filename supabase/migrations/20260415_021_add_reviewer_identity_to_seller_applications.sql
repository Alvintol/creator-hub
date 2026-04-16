alter table public.seller_applications
add column if not exists reviewed_by uuid
references public.profiles(user_id) on delete set null;