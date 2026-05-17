-- Adds an admin-hidden lock state to listings.
-- Admin-hidden listings stay inactive and cannot be edited/deleted by creators
-- until an admin restores them.

alter table public.listings
  add column if not exists admin_hidden_at timestamptz,
  add column if not exists admin_hidden_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists admin_hidden_report_id uuid references public.moderation_reports(id) on delete set null;

create index if not exists listings_admin_hidden_at_idx
  on public.listings (admin_hidden_at)
  where admin_hidden_at is not null;

create index if not exists listings_admin_hidden_report_id_idx
  on public.listings (admin_hidden_report_id)
  where admin_hidden_report_id is not null;

-- Backfill any currently hidden listings where the latest admin moderation action
-- was an admin hide action.
with latest_listing_action as (
  select distinct on (lma.listing_id)
    lma.listing_id,
    lma.action_type,
    lma.admin_user_id,
    lma.moderation_report_id,
    lma.created_at
  from public.listing_moderation_actions lma
  order by lma.listing_id, lma.created_at desc
)
update public.listings l
set
  admin_hidden_at = latest_listing_action.created_at,
  admin_hidden_by_user_id = latest_listing_action.admin_user_id,
  admin_hidden_report_id = latest_listing_action.moderation_report_id
from latest_listing_action
where latest_listing_action.listing_id = l.id
  and latest_listing_action.action_type = 'admin_hidden'
  and l.is_active is false
  and l.admin_hidden_at is null;

-- Recreate owner policies so creators cannot update/delete admin-hidden listings.
drop policy if exists "listings approved seller insert"
  on public.listings;

create policy "listings approved seller insert"
  on public.listings
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
    and admin_hidden_at is null
    and admin_hidden_by_user_id is null
    and admin_hidden_report_id is null
  );

drop policy if exists "listings approved seller update own"
  on public.listings;

create policy "listings approved seller update own"
  on public.listings
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
    and admin_hidden_at is null
  )
  with check (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
    and admin_hidden_at is null
    and admin_hidden_by_user_id is null
    and admin_hidden_report_id is null
  );

drop policy if exists "listings approved seller delete own"
  on public.listings;

create policy "listings approved seller delete own"
  on public.listings
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_approved_seller(auth.uid())
    and admin_hidden_at is null
  );

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
  v_previous_admin_hidden_at timestamptz;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to hide a listing.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can hide listings.'
      using errcode = '42501';
  end if;

  select
    l.status::text,
    l.is_active,
    l.admin_hidden_at
  into
    v_previous_status,
    v_previous_is_active,
    v_previous_admin_hidden_at
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

  if v_previous_admin_hidden_at is not null then
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
    admin_hidden_at = now(),
    admin_hidden_by_user_id = v_admin_user_id,
    admin_hidden_report_id = p_moderation_report_id,
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
  v_previous_admin_hidden_at timestamptz;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to restore a listing.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can restore listings.'
      using errcode = '42501';
  end if;

  select
    l.status::text,
    l.is_active,
    l.admin_hidden_at
  into
    v_previous_status,
    v_previous_is_active,
    v_previous_admin_hidden_at
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

  if v_previous_status <> 'published' then
    raise exception 'Only published listings can be restored to public visibility.'
      using errcode = '23514';
  end if;

  if v_previous_admin_hidden_at is null and v_previous_is_active is true then
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
    admin_hidden_at = null,
    admin_hidden_by_user_id = null,
    admin_hidden_report_id = null,
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

create or replace function public.get_admin_moderation_report_summary()
returns table (
  submitted_count bigint,
  active_count bigint,
  resolved_count bigint,
  unread_reporter_update_count bigint,
  profile_under_review_count bigint,
  hidden_listing_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_user_id uuid := auth.uid();
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to view moderation report summaries.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can view moderation report summaries.'
      using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*)
      from public.moderation_reports mr
      where mr.status = 'submitted'
    ) as submitted_count,
    (
      select count(*)
      from public.moderation_reports mr
      where mr.resolved_at is null
    ) as active_count,
    (
      select count(*)
      from public.moderation_reports mr
      where mr.resolved_at is not null
    ) as resolved_count,
    (
      select count(*)
      from public.moderation_reports mr
      where mr.reporter_status_updated_at is not null
        and (
          mr.reporter_seen_at is null
          or mr.reporter_status_updated_at > mr.reporter_seen_at
        )
    ) as unread_reporter_update_count,
    (
      select count(*)
      from public.profile_moderation_states pms
      where pms.is_under_review is true
    ) as profile_under_review_count,
    (
      select count(*)
      from public.listings l
      where l.admin_hidden_at is not null
    ) as hidden_listing_count;
end;
$$;

revoke all on function public.admin_hide_listing(uuid, uuid, text) from public;
revoke all on function public.admin_restore_listing(uuid, uuid, text) from public;
revoke all on function public.get_admin_moderation_report_summary() from public;

grant execute on function public.admin_hide_listing(uuid, uuid, text) to authenticated;
grant execute on function public.admin_restore_listing(uuid, uuid, text) to authenticated;
grant execute on function public.get_admin_moderation_report_summary() to authenticated;