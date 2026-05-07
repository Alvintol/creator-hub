-- Allows admin conversation unlock/reopen events to be logged.
-- Locking already works, which means `admin_locked` is already accepted by
-- conversation_events_type_check. This migration safely preserves the current
-- check constraint and adds `admin_reopened`.

do $$
declare
  v_constraint_definition text;
begin
  select pg_get_constraintdef(c.oid)
  into v_constraint_definition
  from pg_constraint c
  where c.conrelid = 'public.conversation_events'::regclass
    and c.conname = 'conversation_events_type_check';

  if v_constraint_definition is null then
    raise exception 'conversation_events_type_check constraint was not found.';
  end if;

  if position('admin_reopened' in v_constraint_definition) > 0 then
    return;
  end if;

  alter table public.conversation_events
    drop constraint conversation_events_type_check;

  execute format(
    'alter table public.conversation_events add constraint conversation_events_type_check %s',
    regexp_replace(
      v_constraint_definition,
      '\)\s*$',
      ' OR (event_type = ''admin_reopened''::text))'
    )
  );
end;
$$;