-- Sprint 6 (launch-scope.md section 7): the non-response notice clock.
-- Refund Policy §7's rule: a first notice, 7 calendar days without a
-- substantive reply, a final notice, 7 further days. Both clocks are
-- enforced here, server-side -- a client cannot send a final notice before
-- the first has actually expired, and "substantive" excludes an automated
-- acknowledgement.
--
-- "Substantive reply" detection reuses what already exists rather than
-- adding a new concept: conversation_messages.message_type is 'system' for
-- every automated/system-authored message (Sprint 4's cancellation events,
-- 20260429_032's foundation) and 'text'/'attachment'/'mixed' for a
-- human-authored one. Any message from the notice's recipient with a
-- message_type other than 'system', timestamped after the first notice was
-- sent, counts as a substantive reply and answers the notice.

create table if not exists public.listing_request_notices (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,

  notice_type text not null check (notice_type in ('first', 'final')),

  sender_user_id uuid not null,
  recipient_user_id uuid not null,

  requested_action text not null check (
    char_length(btrim(requested_action)) >= 10
    and char_length(btrim(requested_action)) <= 1000
  ),

  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,

  -- Set the moment a substantive reply is observed from the recipient,
  -- whether that happens to be checked by send_listing_request_final_notice
  -- or by a future poll. An answered notice can never be the basis for a
  -- final notice or a closure.
  answered_at timestamptz null,
  answered_by_message_id uuid null references public.conversation_messages(id),

  -- Delivery outcome for the transactional email this notice's send RPC is
  -- always followed by (see POST /api/notices/first|final in api/server.js
  -- -- a Postgres RPC cannot call an email provider itself). 'pending' until
  -- the API attempts the send; a disputed closure can point at this to show
  -- the notice was accepted for delivery, not just written to the database.
  email_status text not null default 'pending' check (
    email_status in ('pending', 'sent', 'failed', 'bounced')
  ),
  email_provider_message_id text null,
  email_attempted_at timestamptz null,
  email_delivered_at timestamptz null,
  email_failed_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (sender_user_id <> recipient_user_id),
  check (expires_at > sent_at),
  check (answered_at is null or answered_by_message_id is not null)
);

-- At most one open (unanswered, unexpired-final) notice cycle per request:
-- a first notice with no final notice sent yet, or a final notice with no
-- closure yet. Enforced in the RPCs below via row locking rather than a
-- partial unique index, because "open" depends on the sibling row (whether
-- a final notice already exists for this first notice's cycle), which a
-- single-table partial index cannot express.
create index if not exists
listing_request_notices_request_idx
on public.listing_request_notices(listing_request_id, created_at desc);

create index if not exists
listing_request_notices_recipient_idx
on public.listing_request_notices(recipient_user_id);

-- Sprint 6 checklist: "Staleness query surfaced in admin." Feeds
-- admin_list_stale_listing_requests (20260922_135).
create index if not exists
listing_request_notices_open_final_idx
on public.listing_request_notices(listing_request_id, expires_at)
where notice_type = 'final' and answered_at is null;

drop trigger if exists
listing_request_notices_set_updated_at
on public.listing_request_notices;

create trigger
listing_request_notices_set_updated_at
before update on public.listing_request_notices
for each row
execute function public.set_updated_at();

alter table public.listing_request_notices enable row level security;

drop policy if exists "notice participants can read"
on public.listing_request_notices;

create policy "notice participants can read"
on public.listing_request_notices
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or recipient_user_id = auth.uid()
);

drop policy if exists "admins can read notices"
on public.listing_request_notices;

create policy "admins can read notices"
on public.listing_request_notices
for select
to authenticated
using (public.is_admin_user(auth.uid()));

-- No insert/update/delete policy for any client role -- every write goes
-- through the security definer RPCs below, matching every other workflow
-- table in this schema. The API's email-delivery update
-- (email_status/email_provider_message_id/...) runs as the service role,
-- which bypasses RLS entirely.

-- Internal helper: true when the recipient has sent a substantive
-- (non-'system') message in this request's conversation since `since`.
-- Never callable directly by a client.
create or replace function public.listing_request_has_substantive_reply(
  p_listing_request_id uuid,
  p_recipient_user_id uuid,
  p_since timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_messages
    join public.conversations
      on conversations.id = conversation_messages.conversation_id
    where conversations.listing_request_id = p_listing_request_id
      and conversation_messages.sender_user_id = p_recipient_user_id
      and conversation_messages.message_type <> 'system'
      and conversation_messages.created_at > p_since
  );
$$;

revoke execute on function public.listing_request_has_substantive_reply(uuid, uuid, timestamptz)
from public, anon, authenticated;

-- Step 1: the waiting party sends a first notice stating what they need
-- from the other party. Either buyer or creator may send one -- whoever is
-- waiting on the other. Refuses if a notice cycle is already open.
create or replace function public.send_listing_request_first_notice(
  p_request_id uuid,
  p_requested_action text
)
returns table (
  notice_id uuid,
  notice_type text,
  recipient_user_id uuid,
  sent_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_requests%rowtype;
  clean_action text := nullif(btrim(coalesce(p_requested_action, '')), '');
  send_time timestamptz := now();
  notice_expires_at timestamptz;
  recipient uuid;
  new_notice_id uuid;
  conversation_id uuid;
  latest_notice public.listing_request_notices%rowtype;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to send a notice.'
      using errcode = '42501';
  end if;

  if clean_action is null
    or char_length(clean_action) < 10
    or char_length(clean_action) > 1000 then
    raise exception
      'State what is needed, in 10 to 1000 characters.'
      using errcode = '22023';
  end if;

  select *
  into request_row
  from public.listing_requests
  where listing_requests.id = p_request_id
    and (
      listing_requests.buyer_user_id = auth.uid()
      or listing_requests.creator_user_id = auth.uid()
    )
  for update;

  if not found then
    raise exception
      'Listing request not found or not accessible.'
      using errcode = 'P0001';
  end if;

  if request_row.status <> 'accepted' then
    raise exception
      'A notice can only be sent on an active request.'
      using errcode = 'P0001';
  end if;

  recipient := case
    when auth.uid() = request_row.buyer_user_id then request_row.creator_user_id
    else request_row.buyer_user_id
  end;

  -- "Open" means the latest notice cycle (first or final) is unanswered and
  -- has not yet expired -- a fresh first notice would restart a clock that
  -- is already running. Lazily self-heals the common case where a
  -- substantive reply arrived but nobody has called
  -- send_listing_request_final_notice since (the only other place this is
  -- checked) -- without this, that first notice's answered_at would never
  -- get set, and this guard would block a *future* notice cycle forever
  -- even after the request had gone quiet again.
  select *
  into latest_notice
  from public.listing_request_notices
  where listing_request_notices.listing_request_id = p_request_id
  order by listing_request_notices.sent_at desc
  limit 1
  for update;

  if found and latest_notice.answered_at is null then
    if public.listing_request_has_substantive_reply(
      p_request_id, latest_notice.recipient_user_id, latest_notice.sent_at
    ) then
      update public.listing_request_notices
      set answered_at = send_time
      where id = latest_notice.id;
    elsif send_time < latest_notice.expires_at then
      raise exception
        'A notice is already open for this request.'
        using errcode = 'P0001';
    end if;
    -- else: the latest notice expired unanswered -- free to send a fresh
    -- first notice (or pursue closure instead; both remain available).
  end if;

  notice_expires_at := send_time + interval '7 days';

  insert into public.listing_request_notices (
    listing_request_id,
    notice_type,
    sender_user_id,
    recipient_user_id,
    requested_action,
    sent_at,
    expires_at
  )
  values (
    p_request_id,
    'first',
    auth.uid(),
    recipient,
    clean_action,
    send_time,
    notice_expires_at
  )
  returning id into new_notice_id;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = p_request_id
  limit 1;

  if conversation_id is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      conversation_id,
      auth.uid(),
      'system',
      format(
        'A first notice was sent: %s. A reply is needed by %s or a final notice may follow.',
        clean_action,
        to_char(notice_expires_at, 'YYYY-MM-DD HH24:MI TZ')
      )
    );
  end if;

  return query
  select new_notice_id, 'first'::text, recipient, send_time, notice_expires_at;
end;
$$;

revoke all on function public.send_listing_request_first_notice(uuid, text)
from public, anon, authenticated;

grant execute on function public.send_listing_request_first_notice(uuid, text)
to authenticated;

-- Step 2: the same sender's final notice, once the first has actually
-- expired and no substantive reply arrived. Both checks run here, not just
-- in the UI.
create or replace function public.send_listing_request_final_notice(
  p_request_id uuid
)
returns table (
  notice_id uuid,
  notice_type text,
  recipient_user_id uuid,
  sent_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  first_notice public.listing_request_notices%rowtype;
  send_time timestamptz := now();
  notice_expires_at timestamptz;
  new_notice_id uuid;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to send a notice.'
      using errcode = '42501';
  end if;

  select *
  into first_notice
  from public.listing_request_notices
  where listing_request_notices.listing_request_id = p_request_id
    and listing_request_notices.notice_type = 'first'
    and listing_request_notices.sender_user_id = auth.uid()
  order by listing_request_notices.sent_at desc
  limit 1
  for update;

  if not found then
    raise exception
      'No first notice was found for you to follow up on this request.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_notices
    where listing_request_notices.listing_request_id = p_request_id
      and listing_request_notices.notice_type = 'final'
      and listing_request_notices.sent_at >= first_notice.sent_at
  ) then
    raise exception
      'A final notice has already been sent for this request.'
      using errcode = 'P0001';
  end if;

  if send_time < first_notice.expires_at then
    raise exception
      'The first notice has not yet expired. It expires at %.',
      to_char(first_notice.expires_at, 'YYYY-MM-DD HH24:MI TZ')
      using errcode = 'P0001';
  end if;

  if first_notice.answered_at is not null then
    raise exception
      'A substantive reply was already received. No final notice is needed.'
      using errcode = 'P0001';
  end if;

  -- Re-check for a substantive reply at send time, in case one arrived
  -- since the first notice row was last touched (answered_at is a
  -- best-effort cache, not the source of truth -- this query is).
  if public.listing_request_has_substantive_reply(
    p_request_id, first_notice.recipient_user_id, first_notice.sent_at
  ) then
    update public.listing_request_notices
    set answered_at = send_time
    where id = first_notice.id;

    raise exception
      'A substantive reply was received after the first notice. No final notice is needed.'
      using errcode = 'P0001';
  end if;

  notice_expires_at := send_time + interval '7 days';

  insert into public.listing_request_notices (
    listing_request_id,
    notice_type,
    sender_user_id,
    recipient_user_id,
    requested_action,
    sent_at,
    expires_at
  )
  values (
    p_request_id,
    'final',
    auth.uid(),
    first_notice.recipient_user_id,
    first_notice.requested_action,
    send_time,
    notice_expires_at
  )
  returning id into new_notice_id;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = p_request_id
  limit 1;

  if conversation_id is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      conversation_id,
      auth.uid(),
      'system',
      format(
        'A final notice was sent, granting 7 further days (until %s). Administrative closure may be requested after that if there is still no substantive reply.',
        to_char(notice_expires_at, 'YYYY-MM-DD HH24:MI TZ')
      )
    );
  end if;

  return query
  select new_notice_id, 'final'::text, first_notice.recipient_user_id, send_time, notice_expires_at;
end;
$$;

revoke all on function public.send_listing_request_final_notice(uuid)
from public, anon, authenticated;

grant execute on function public.send_listing_request_final_notice(uuid)
to authenticated;

notify pgrst, 'reload schema';
