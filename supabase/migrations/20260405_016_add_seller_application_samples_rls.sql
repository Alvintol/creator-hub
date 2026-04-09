alter table public.seller_application_samples enable row level security;

grant select, insert, update, delete
on table public.seller_application_samples
to authenticated;

drop policy if exists "seller_application_samples_select_own"
on public.seller_application_samples;

create policy "seller_application_samples_select_own"
on public.seller_application_samples
for select
to authenticated
using (
  exists (
    select 1
    from public.seller_applications
    where seller_applications.id = seller_application_samples.application_id
      and seller_applications.user_id = auth.uid()
  )
);

drop policy if exists "seller_application_samples_insert_own"
on public.seller_application_samples;

create policy "seller_application_samples_insert_own"
on public.seller_application_samples
for insert
to authenticated
with check (
  exists (
    select 1
    from public.seller_applications
    where seller_applications.id = seller_application_samples.application_id
      and seller_applications.user_id = auth.uid()
  )
);

drop policy if exists "seller_application_samples_update_own"
on public.seller_application_samples;

create policy "seller_application_samples_update_own"
on public.seller_application_samples
for update
to authenticated
using (
  exists (
    select 1
    from public.seller_applications
    where seller_applications.id = seller_application_samples.application_id
      and seller_applications.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.seller_applications
    where seller_applications.id = seller_application_samples.application_id
      and seller_applications.user_id = auth.uid()
  )
);

drop policy if exists "seller_application_samples_delete_own"
on public.seller_application_samples;

create policy "seller_application_samples_delete_own"
on public.seller_application_samples
for delete
to authenticated
using (
  exists (
    select 1
    from public.seller_applications
    where seller_applications.id = seller_application_samples.application_id
      and seller_applications.user_id = auth.uid()
  )
);