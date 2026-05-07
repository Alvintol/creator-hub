-- Adds admin-only listing moderation actions for report review.
-- First-pass scope:
-- - Hide listing by setting is_active = false
-- - Restore listing by setting is_active = true
-- - Preserve listing.status so the action is reversible
-- - Log changed actions in listing_moderation_actions
-- - No penalties, suspensions, or notifications yet

create table if not exists public.listing_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderation_report_id uuid references public.moderation_reports(id) on delete set null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  admin_user_id uuid not null,
  action_type text not null,
  previous_status text not null,
  new_status text not null,
  previous_is_active boolean not null,
  new_is_active boolean not null,
  admin_note text,
  created_at timestamptz not null default now(),
  constraint listing_moderation_actions_type_check
    check (action_type in ('admin_hidden', 'admin_restored'))
);

create index if not exists listing_moderation_actions_report_id_idx
  on public.listing_moderation_actions (moderation_report_id);

create index if not exists listing_moderation_actions_listing_id_idx
  on public.listing_moderation_actions (listing_id);

create index if not exists listing_moderation_actions_admin_user_id_idx
  on public.listing_moderation_actions (admin_user_id);

alter table public.listing_moderation_actions enable row level security;

drop policy if exists "listing moderation actions admin select"
  on public.listing_moderation_actions;

create policy "listing moderation actions admin select"
  on public.listing_moderation_actions
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

create or replace function public.admin_hide_listing(
  p_listing_id uuid,
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
  v_report_listing_id uuid;
  v_previous_status text;
  v_previous_is_active boolean;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to hide a listing.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can hide listings.'
      using errcode = '42501';
  end if;

  select l.status::text, l.is_active
  into v_previous_status, v_previous_is_active
  from public.listings l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.'
      using errcode = 'P0002';
  end if;

  if p_moderation_report_id is not null then
    select mr.listing_id
    into v_report_listing_id
    from public.moderation_reports mr
    where mr.id = p_moderation_report_id;

    if not found then
      raise exception 'Moderation report not found.'
        using errcode = 'P0002';
    end if;

    if v_report_listing_id is distinct from p_listing_id then
      raise exception 'Moderation report is not tied to this listing.'
        using errcode = '23514';
    end if;
  end if;

  -- Idempotent no-op. Already hidden/inactive listings do not need another log.
  if v_previous_is_active is false then
    return jsonb_build_object(
      'listing_id', p_listing_id,
      'previous_status', v_previous_status,
      'new_status', v_previous_status,
      'previous_is_active', v_previous_is_active,
      'new_is_active', v_previous_is_active,
      'changed', false
    );
  end if;

  update public.listings
  set
    is_active = false,
    updated_at = now()
  where id = p_listing_id;

  insert into public.listing_moderation_actions (
    moderation_report_id,
    listing_id,
    admin_user_id,
    action_type,
    previous_status,
    new_status,
    previous_is_active,
    new_is_active,
    admin_note
  )
  values (
    p_moderation_report_id,
    p_listing_id,
    v_admin_user_id,
    'admin_hidden',
    v_previous_status,
    v_previous_status,
    v_previous_is_active,
    false,
    nullif(trim(coalesce(p_admin_note, '')), '')
  );

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'previous_status', v_previous_status,
    'new_status', v_previous_status,
    'previous_is_active', v_previous_is_active,
    'new_is_active', false,
    'changed', true
  );
end;
$$;

create or replace function public.admin_restore_listing(
  p_listing_id uuid,
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
  v_report_listing_id uuid;
  v_previous_status text;
  v_previous_is_active boolean;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to restore a listing.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can restore listings.'
      using errcode = '42501';
  end if;

  select l.status::text, l.is_active
  into v_previous_status, v_previous_is_active
  from public.listings l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.'
      using errcode = 'P0002';
  end if;

  if p_moderation_report_id is not null then
    select mr.listing_id
    into v_report_listing_id
    from public.moderation_reports mr
    where mr.id = p_moderation_report_id;

    if not found then
      raise exception 'Moderation report not found.'
        using errcode = 'P0002';
    end if;

    if v_report_listing_id is distinct from p_listing_id then
      raise exception 'Moderation report is not tied to this listing.'
        using errcode = '23514';
    end if;
  end if;

  -- Only published listings should be restored to public visibility.
  if v_previous_status <> 'published' then
    raise exception 'Only published listings can be restored to public visibility.'
      using errcode = '23514';
  end if;

  -- Idempotent no-op. Already active listings do not need another log.
  if v_previous_is_active is true then
    return jsonb_build_object(
      'listing_id', p_listing_id,
      'previous_status', v_previous_status,
      'new_status', v_previous_status,
      'previous_is_active', v_previous_is_active,
      'new_is_active', v_previous_is_active,
      'changed', false
    );
  end if;

  update public.listings
  set
    is_active = true,
    updated_at = now()
  where id = p_listing_id;

  insert into public.listing_moderation_actions (
    moderation_report_id,
    listing_id,
    admin_user_id,
    action_type,
    previous_status,
    new_status,
    previous_is_active,
    new_is_active,
    admin_note
  )
  values (
    p_moderation_report_id,
    p_listing_id,
    v_admin_user_id,
    'admin_restored',
    v_previous_status,
    v_previous_status,
    v_previous_is_active,
    true,
    nullif(trim(coalesce(p_admin_note, '')), '')
  );

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'previous_status', v_previous_status,
    'new_status', v_previous_status,
    'previous_is_active', v_previous_is_active,
    'new_is_active', true,
    'changed', true
  );
end;
$$;

revoke all on function public.admin_hide_listing(uuid, uuid, text) from public;
revoke all on function public.admin_restore_listing(uuid, uuid, text) from public;

grant execute on function public.admin_hide_listing(uuid, uuid, text) to authenticated;
grant execute on function public.admin_restore_listing(uuid, uuid, text) to authenticated;