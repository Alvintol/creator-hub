-- Linked external platform identities for a CreatorHub profile
-- One row per platform per user in v1
create table if not exists public.profile_platform_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.profiles(user_id) on delete cascade,
  platform text not null,
  platform_user_id text not null,
  platform_login text,
  platform_display_name text,
  profile_url text,
  account_created_at timestamptz,
  connected_at timestamptz not null default now(),
  last_activity_at timestamptz,
  activity_checked_at timestamptz,
  is_active_recently boolean,
  metadata jsonb not null default '{}' :: jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_platform_accounts_platform_check check (platform in ('twitch', 'youtube')),
  constraint profile_platform_accounts_platform_identity_unique unique (platform, platform_user_id),
  constraint profile_platform_accounts_profile_platform_unique unique (profile_user_id, platform)
);

create index if not exists profile_platform_accounts_profile_user_id_idx on public.profile_platform_accounts (profile_user_id);

create index if not exists profile_platform_accounts_platform_idx on public.profile_platform_accounts (platform);

drop trigger if exists set_profile_platform_accounts_updated_at on public.profile_platform_accounts;

create trigger set_profile_platform_accounts_updated_at before
update
  on public.profile_platform_accounts for each row execute function public.set_updated_at();