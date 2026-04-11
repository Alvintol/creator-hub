alter table public.seller_application_samples enable row level security;

create unique index if not exists seller_application_samples_one_video_per_application_idx
  on public.seller_application_samples(application_id)
  where sample_type = 'video';

drop policy if exists "seller application samples read own" on public.seller_application_samples;
drop policy if exists "seller application samples insert own editable" on public.seller_application_samples;
drop policy if exists "seller application samples update own editable" on public.seller_application_samples;
drop policy if exists "seller application samples delete own editable" on public.seller_application_samples;
drop policy if exists "seller application samples read admin" on public.seller_application_samples;

create policy "seller application samples read own"
on public.seller_application_samples
for select
to authenticated
using (
  exists (
    select 1
    from public.seller_applications application
    where application.id = application_id
      and application.profile_user_id = auth.uid()
  )
);

create policy "seller application samples insert own editable"
on public.seller_application_samples
for insert
to authenticated
with check (
  exists (
    select 1
    from public.seller_applications application
    where application.id = application_id
      and application.profile_user_id = auth.uid()
      and application.status in ('draft', 'needs_changes')
  )
);

create policy "seller application samples update own editable"
on public.seller_application_samples
for update
to authenticated
using (
  exists (
    select 1
    from public.seller_applications application
    where application.id = application_id
      and application.profile_user_id = auth.uid()
      and application.status in ('draft', 'needs_changes')
  )
)
with check (
  exists (
    select 1
    from public.seller_applications application
    where application.id = application_id
      and application.profile_user_id = auth.uid()
      and application.status in ('draft', 'needs_changes')
  )
);

create policy "seller application samples delete own editable"
on public.seller_application_samples
for delete
to authenticated
using (
  exists (
    select 1
    from public.seller_applications application
    where application.id = application_id
      and application.profile_user_id = auth.uid()
      and application.status in ('draft', 'needs_changes')
  )
);

create policy "seller application samples read admin"
on public.seller_application_samples
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_roles admin_role
    where admin_role.profile_user_id = auth.uid()
      and admin_role.role = 'admin'
  )
);