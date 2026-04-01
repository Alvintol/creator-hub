-- Manual seller application pipeline
-- Seller access should not be self-serve
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_applications_status_check check (
    status in (
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'needs_changes'
    )
  ),
  constraint seller_applications_one_per_profile_unique unique (profile_user_id)
);

create index if not exists seller_applications_profile_user_id_idx on public.seller_applications (profile_user_id);

create index if not exists seller_applications_status_idx on public.seller_applications (status);