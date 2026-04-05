-- RLS for seller applications
alter table
  public.seller_applications enable row level security;

drop policy if exists "seller applications read own" on public.seller_applications;

create policy "seller applications read own" on public.seller_applications for
select
  to authenticated using (auth.uid() = profile_user_id);

drop policy if exists "seller applications insert own" on public.seller_applications;

create policy "seller applications insert own" on public.seller_applications for
insert
  to authenticated with check (
    auth.uid() = profile_user_id
    and status in ('draft', 'submitted', 'needs_changes')
  );

drop policy if exists "seller applications update own editable states" on public.seller_applications;

create policy "seller applications update own editable states" on public.seller_applications for
update
  to authenticated using (
    auth.uid() = profile_user_id
    and status in ('draft', 'submitted', 'needs_changes')
  ) with check (
    auth.uid() = profile_user_id
    and status in ('draft', 'submitted', 'needs_changes')
  );