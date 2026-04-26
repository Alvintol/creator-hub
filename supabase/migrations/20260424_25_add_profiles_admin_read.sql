drop policy if exists "profiles admin read" on public.profiles;

create policy "profiles admin read" on public.profiles for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.admin_roles
      where
        admin_roles.profile_user_id = auth.uid()
        and admin_roles.role = 'admin'
    )
  );