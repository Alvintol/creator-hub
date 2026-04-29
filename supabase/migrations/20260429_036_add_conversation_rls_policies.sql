-- RLS and grants for the messaging foundation.
alter table
  public.conversations enable row level security;

alter table
  public.conversation_participants enable row level security;

alter table
  public.conversation_messages enable row level security;

alter table
  public.conversation_message_attachments enable row level security;

alter table
  public.conversation_reports enable row level security;

alter table
  public.conversation_events enable row level security;

grant
select
  on public.conversations to authenticated;

grant
select
  on public.conversation_participants to authenticated;

grant
select
,
insert
  on public.conversation_messages to authenticated;

grant
select
  on public.conversation_message_attachments to authenticated;

grant
select
,
insert
,
update
  on public.conversation_reports to authenticated;

grant
select
  on public.conversation_events to authenticated;

create policy "conversations participants read" on public.conversations for
select
  to authenticated using (
    public.is_conversation_participant(id, auth.uid())
  );

create policy "conversations admin read" on public.conversations for
select
  to authenticated using (public.is_admin_user(auth.uid()));

create policy "conversation participants read same conversation" on public.conversation_participants for
select
  to authenticated using (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

create policy "conversation participants admin read" on public.conversation_participants for
select
  to authenticated using (public.is_admin_user(auth.uid()));

create policy "conversation messages participants read" on public.conversation_messages for
select
  to authenticated using (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

create policy "conversation messages admin read" on public.conversation_messages for
select
  to authenticated using (public.is_admin_user(auth.uid()));

create policy "conversation messages participants insert open text" on public.conversation_messages for
insert
  to authenticated with check (
    sender_user_id = auth.uid()
    and message_type = 'text'
    and public.is_conversation_participant(conversation_id, auth.uid())
    and exists (
      select
        1
      from
        public.conversations
      where
        conversations.id = conversation_messages.conversation_id
        and conversations.status = 'open'
    )
  );

create policy "conversation attachments participants read" on public.conversation_message_attachments for
select
  to authenticated using (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

create policy "conversation attachments admin read" on public.conversation_message_attachments for
select
  to authenticated using (public.is_admin_user(auth.uid()));

create policy "conversation reports reporter read own" on public.conversation_reports for
select
  to authenticated using (reporter_user_id = auth.uid());

create policy "conversation reports admin read" on public.conversation_reports for
select
  to authenticated using (public.is_admin_user(auth.uid()));

create policy "conversation reports participants insert" on public.conversation_reports for
insert
  to authenticated with check (
    reporter_user_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
    and (
      message_id is null
      or exists (
        select
          1
        from
          public.conversation_messages
        where
          conversation_messages.id = conversation_reports.message_id
          and conversation_messages.conversation_id = conversation_reports.conversation_id
      )
    )
    and (
      reported_user_id is null
      or public.is_conversation_participant(conversation_id, reported_user_id)
    )
  );

create policy "conversation reports admin update" on public.conversation_reports for
update
  to authenticated using (public.is_admin_user(auth.uid())) with check (public.is_admin_user(auth.uid()));

create policy "conversation events participants read" on public.conversation_events for
select
  to authenticated using (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

create policy "conversation events admin read" on public.conversation_events for
select
  to authenticated using (public.is_admin_user(auth.uid()));