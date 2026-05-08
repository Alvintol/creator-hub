-- Adds admin-only profile moderation review state.
-- First-pass scope:
-- - Mark a profile as under review
-- - Clear the under-review flag
-- - Log every changed action
-- - No suspension, hiding, penalties, or notifications yet

create table if not exists public.profile_moderation_states (
  profile_user_id uuid primary key references public.profiles(user_id) on delete cascade,
  is_under_review boolean not null default false,
  review_started_at timestamptz,
  review_started_by_user_id uuid,
  review_cleared_at timestamptz,
  review_cleared_by_user_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderation_report_id uuid references public.moderation_reports(id) on delete set null,
  profile_user_id uuid not null references public.profiles(user_id) on delete cascade,
  admin_user_id uuid not null,
  action_type text not null,
  previous_is_under_review boolean not null,
  new_is_under_review boolean not null,
  admin_note text,
  created_at timestamptz not null default now(),
  constraint profile_moderation_actions_type_check
    check (action_type in ('under_review', 'review_cleared'))
);

create index if not exists profile_moderation_actions_report_id_idx
  on public.profile_moderation_actions (moderation_report_id);

create index if not exists profile_moderation_actions_profile_user_id_idx
  on public.profile_moderation_actions (profile_user_id);

create index if not exists profile_moderation_actions_admin_user_id_idx
  on public.profile_moderation_actions (admin_user_id);

alter table public.profile_moderation_states enable row level security;
alter table public.profile_moderation_actions enable row level security;

drop policy if exists "profile moderation states admin select"
  on public.profile_moderation_states;

create policy "profile moderation states admin select"
  on public.profile_moderation_states
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "profile moderation actions admin select"
  on public.profile_moderation_actions;

create policy "profile moderation actions admin select"
  on public.profile_moderation_actions
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

create or replace function public.admin_mark_profile_under_review(
  p_profile_user_id uuid,
  p_moderation_report_id uuid default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_user_id uuid := auth.uid();
  v_report_profile_user_id uuid;
  v_previous_is_under_review boolean := false;
  v_profile_exists boolean := false;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to mark a profile under review.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can mark profiles under review.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_profile_user_id
  )
  into v_profile_exists;

  if not v_profile_exists then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  if p_moderation_report_id is not null then
    select mr.profile_user_id
    into v_report_profile_user_id
    from public.moderation_reports mr
    where mr.id = p_moderation_report_id;

    if not found then
      raise exception 'Moderation report not found.'
        using errcode = 'P0002';
    end if;

    if v_report_profile_user_id is distinct from p_profile_user_id then
      raise exception 'Moderation report is not tied to this profile.'
        using errcode = '23514';
    end if;
  end if;

  select pms.is_under_review
  into v_previous_is_under_review
  from public.profile_moderation_states pms
  where pms.profile_user_id = p_profile_user_id
  for update;

  v_previous_is_under_review := coalesce(v_previous_is_under_review, false);

  -- Idempotent no-op. Already-under-review profiles do not need another log.
  if v_previous_is_under_review is true then
    return jsonb_build_object(
      'profile_user_id', p_profile_user_id,
      'previous_is_under_review', true,
      'new_is_under_review', true,
      'changed', false
    );
  end if;

  insert into public.profile_moderation_states (
    profile_user_id,
    is_under_review,
    review_started_at,
    review_started_by_user_id,
    review_cleared_at,
    review_cleared_by_user_id,
    updated_at
  )
  values (
    p_profile_user_id,
    true,
    now(),
    v_admin_user_id,
    null,
    null,
    now()
  )
  on conflict (profile_user_id)
  do update set
    is_under_review = true,
    review_started_at = now(),
    review_started_by_user_id = excluded.review_started_by_user_id,
    review_cleared_at = null,
    review_cleared_by_user_id = null,
    updated_at = now();

  insert into public.profile_moderation_actions (
    moderation_report_id,
    profile_user_id,
    admin_user_id,
    action_type,
    previous_is_under_review,
    new_is_under_review,
    admin_note
  )
  values (
    p_moderation_report_id,
    p_profile_user_id,
    v_admin_user_id,
    'under_review',
    false,
    true,
    nullif(trim(coalesce(p_admin_note, '')), '')
  );

  return jsonb_build_object(
    'profile_user_id', p_profile_user_id,
    'previous_is_under_review', false,
    'new_is_under_review', true,
    'changed', true
  );
end;
$$;

create or replace function public.admin_clear_profile_review_flag(
  p_profile_user_id uuid,
  p_moderation_report_id uuid default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_user_id uuid := auth.uid();
  v_report_profile_user_id uuid;
  v_previous_is_under_review boolean := false;
  v_profile_exists boolean := false;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to clear profile review.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can clear profile review.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_profile_user_id
  )
  into v_profile_exists;

  if not v_profile_exists then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  if p_moderation_report_id is not null then
    select mr.profile_user_id
    into v_report_profile_user_id
    from public.moderation_reports mr
    where mr.id = p_moderation_report_id;

    if not found then
      raise exception 'Moderation report not found.'
        using errcode = 'P0002';
    end if;

    if v_report_profile_user_id is distinct from p_profile_user_id then
      raise exception 'Moderation report is not tied to this profile.'
        using errcode = '23514';
    end if;
  end if;

  select pms.is_under_review
  into v_previous_is_under_review
  from public.profile_moderation_states pms
  where pms.profile_user_id = p_profile_user_id
  for update;

  v_previous_is_under_review := coalesce(v_previous_is_under_review, false);

  -- Idempotent no-op. Profiles not under review do not need another log.
  if v_previous_is_under_review is false then
    return jsonb_build_object(
      'profile_user_id', p_profile_user_id,
      'previous_is_under_review', false,
      'new_is_under_review', false,
      'changed', false
    );
  end if;

  update public.profile_moderation_states
  set
    is_under_review = false,
    review_cleared_at = now(),
    review_cleared_by_user_id = v_admin_user_id,
    updated_at = now()
  where profile_user_id = p_profile_user_id;

  insert into public.profile_moderation_actions (
    moderation_report_id,
    profile_user_id,
    admin_user_id,
    action_type,
    previous_is_under_review,
    new_is_under_review,
    admin_note
  )
  values (
    p_moderation_report_id,
    p_profile_user_id,
    v_admin_user_id,
    'review_cleared',
    true,
    false,
    nullif(trim(coalesce(p_admin_note, '')), '')
  );

  return jsonb_build_object(
    'profile_user_id', p_profile_user_id,
    'previous_is_under_review', true,
    'new_is_under_review', false,
    'changed', true
  );
end;
$$;

revoke all on function public.admin_mark_profile_under_review(uuid, uuid, text) from public;
revoke all on function public.admin_clear_profile_review_flag(uuid, uuid, text) from public;

grant execute on function public.admin_mark_profile_under_review(uuid, uuid, text) to authenticated;
grant execute on function public.admin_clear_profile_review_flag(uuid, uuid, text) to authenticated;