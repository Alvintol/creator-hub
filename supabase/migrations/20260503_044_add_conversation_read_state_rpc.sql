-- Adds a controlled RPC for marking a conversation as read.
-- Uses conversation_participants.last_read_at as the source of truth.

create index if not exists conversation_participants_user_last_read_idx
on public.conversation_participants using btree (
  user_id,
  last_read_at desc
);

create or replace function public.mark_conversation_read(
  p_conversation_id uuid
)
returns public.conversation_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  participant_row public.conversation_participants;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'You must be signed in to mark a conversation as read.';
  end if;

  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = current_user_id
  returning * into participant_row;

  if not found then
    raise exception 'You do not have access to this conversation.';
  end if;

  return participant_row;
end;
$$;

grant execute on function public.mark_conversation_read(uuid)
to authenticated;