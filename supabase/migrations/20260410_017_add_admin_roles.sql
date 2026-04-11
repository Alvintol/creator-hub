create table if not exists public.admin_roles (
  profile_user_id uuid primary key
    references public.profiles(user_id) on delete cascade,

  role text not null check (role in ('admin')) default 'admin',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

drop policy if exists "admin roles read own" on public.admin_roles;
create policy "admin roles read own"
on public.admin_roles
for select
to authenticated
using (auth.uid() = profile_user_id);