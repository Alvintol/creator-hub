-- Adds admin-only moderation controls for locking and reopening conversations.
-- First-pass scope:
-- - No penalties
-- - No email notifications
-- - No user suspension/ban logic
-- - No listing/profile moderation action logic

create or replace function public.admin_lock_conversation(
  p_conversation_id uuid,
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
  v_previous_status text;
  v_report_conversation_id uuid;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to lock a conversation.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can lock conversations.'
      using errcode = '42501';
  end if;

  select c.status::text
  into v_previous_status
  from public.conversations c
  where c.id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found.'
      using errcode = 'P0002';
  end if;

  if p_moderation_report_id is not null then
    select mr.conversation_id
    into v_report_conversation_id
    from public.moderation_reports mr
    where mr.id = p_moderation_report_id;

    if not found then
      raise exception 'Moderation report not found.'
        using errcode = 'P0002';
    end if;

    if v_report_conversation_id is distinct from p_conversation_id then
      raise exception 'Moderation report is not tied to this conversation.'
        using errcode = '23514';
    end if;
  end if;

  -- Idempotent: locking an already locked conversation is a safe no-op.
  if v_previous_status = 'admin_locked' then
    return jsonb_build_object(
      'conversation_id', p_conversation_id,
      'previous_status', v_previous_status,
      'new_status', 'admin_locked',
      'changed', false
    );
  end if;

  -- User-ended/closed conversations are already non-actionable.
  -- Keep this first pass focused on locking currently open conversations only.
  if v_previous_status <> 'open' then
    raise exception 'Only open conversations can be admin locked.'
      using errcode = '23514';
  end if;

  update public.conversations
  set
    status = 'admin_locked',
    updated_at = now()
  where id = p_conversation_id;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    p_conversation_id,
    v_admin_user_id,
    'admin_locked',
    jsonb_strip_nulls(
      jsonb_build_object(
        'previous_status', v_previous_status,
        'new_status', 'admin_locked',
        'moderation_report_id', p_moderation_report_id,
        'admin_note', nullif(trim(coalesce(p_admin_note, '')), '')
      )
    )
  );

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'previous_status', v_previous_status,
    'new_status', 'admin_locked',
    'changed', true
  );
end;
$$;

create or replace function public.admin_reopen_conversation(
  p_conversation_id uuid,
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
  v_previous_status text;
  v_report_conversation_id uuid;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to reopen a conversation.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can reopen conversations.'
      using errcode = '42501';
  end if;

  select c.status::text
  into v_previous_status
  from public.conversations c
  where c.id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found.'
      using errcode = 'P0002';
  end if;

  if p_moderation_report_id is not null then
    select mr.conversation_id
    into v_report_conversation_id
    from public.moderation_reports mr
    where mr.id = p_moderation_report_id;

    if not found then
      raise exception 'Moderation report not found.'
        using errcode = 'P0002';
    end if;

    if v_report_conversation_id is distinct from p_conversation_id then
      raise exception 'Moderation report is not tied to this conversation.'
        using errcode = '23514';
    end if;
  end if;

  -- Idempotent: reopening only applies to admin-locked conversations.
  if v_previous_status <> 'admin_locked' then
    return jsonb_build_object(
      'conversation_id', p_conversation_id,
      'previous_status', v_previous_status,
      'new_status', v_previous_status,
      'changed', false
    );
  end if;

  update public.conversations
  set
    status = 'open',
    updated_at = now()
  where id = p_conversation_id;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    p_conversation_id,
    v_admin_user_id,
    'admin_reopened',
    jsonb_strip_nulls(
      jsonb_build_object(
        'previous_status', v_previous_status,
        'new_status', 'open',
        'moderation_report_id', p_moderation_report_id,
        'admin_note', nullif(trim(coalesce(p_admin_note, '')), '')
      )
    )
  );

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'previous_status', v_previous_status,
    'new_status', 'open',
    'changed', true
  );
end;
$$;

revoke all on function public.admin_lock_conversation(uuid, uuid, text) from public;
revoke all on function public.admin_reopen_conversation(uuid, uuid, text) from public;

grant execute on function public.admin_lock_conversation(uuid, uuid, text) to authenticated;
grant execute on function public.admin_reopen_conversation(uuid, uuid, text) to authenticated;