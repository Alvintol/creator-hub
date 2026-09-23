-- Sprint 6 (launch-scope.md section 7, "Early review" row): a missed
-- essential deadline, credible fraud, or the creator stating they cannot
-- complete lets either party skip the 7+7 day wait. This is deliberately a
-- separate admin-review entry point rather than a client-settable bypass
-- flag on admin_close_listing_request_for_non_response (20260922_133) --
-- an admin has to look at the flag and approve it before it can satisfy
-- that RPC's precondition, so the gate is a human decision, not a
-- parameter.

create table if not exists public.listing_request_early_review_flags (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,

  flagged_by_user_id uuid not null,

  category text not null check (
    category in ('missed_essential_deadline', 'credible_fraud', 'creator_cannot_complete')
  ),

  note text not null check (
    char_length(btrim(note)) >= 10
    and char_length(btrim(note)) <= 2000
  ),

  status text not null default 'pending' check (
    status in ('pending', 'approved', 'declined')
  ),

  reviewed_by_admin_user_id uuid null,
  reviewed_at timestamptz null,
  decision_note text null check (
    decision_note is null or char_length(btrim(decision_note)) <= 2000
  ),

  created_at timestamptz not null default now(),

  check (
    (status = 'pending' and reviewed_at is null and reviewed_by_admin_user_id is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by_admin_user_id is not null)
  )
);

-- At most one open flag per request -- a second report while one is
-- pending adds noise rather than information; the admin already has the
-- request open once they start reviewing the first.
create unique index if not exists
listing_request_early_review_flags_one_open_idx
on public.listing_request_early_review_flags(listing_request_id)
where status = 'pending';

create index if not exists
listing_request_early_review_flags_request_idx
on public.listing_request_early_review_flags(listing_request_id);

-- Tier 2 admin-queue index, same pattern as the cancellation proposals'
-- disputed_idx.
create index if not exists
listing_request_early_review_flags_pending_idx
on public.listing_request_early_review_flags(created_at desc)
where status = 'pending';

alter table public.listing_request_early_review_flags enable row level security;

drop policy if exists "early review flag participants can read"
on public.listing_request_early_review_flags;

create policy "early review flag participants can read"
on public.listing_request_early_review_flags
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_requests
    where listing_requests.id = listing_request_early_review_flags.listing_request_id
      and (
        listing_requests.buyer_user_id = auth.uid()
        or listing_requests.creator_user_id = auth.uid()
      )
  )
);

drop policy if exists "admins can read early review flags"
on public.listing_request_early_review_flags;

create policy "admins can read early review flags"
on public.listing_request_early_review_flags
for select
to authenticated
using (public.is_admin_user(auth.uid()));

-- No insert/update/delete policy for any client role -- every write goes
-- through the RPCs below.

-- Either party raises a flag. No status check on the request itself beyond
-- "not already closed/declined/archived" -- the whole point is that this
-- can fire even while the ordinary notice clock has not run yet, or has
-- none open at all.
create or replace function public.flag_listing_request_for_early_review(
  p_request_id uuid,
  p_category text,
  p_note text
)
returns table (
  flag_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_requests%rowtype;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  new_flag_id uuid;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to request an early review.'
      using errcode = '42501';
  end if;

  if p_category not in ('missed_essential_deadline', 'credible_fraud', 'creator_cannot_complete') then
    raise exception
      'Unknown early review category: %.', p_category
      using errcode = '22023';
  end if;

  if clean_note is null or char_length(clean_note) < 10 then
    raise exception
      'Explain the early review request in at least 10 characters.'
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

  if request_row.status not in ('accepted') then
    raise exception
      'Early review can only be requested on an active request.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_early_review_flags
    where listing_request_early_review_flags.listing_request_id = p_request_id
      and listing_request_early_review_flags.status = 'pending'
  ) then
    raise exception
      'An early review request is already pending for this request.'
      using errcode = 'P0001';
  end if;

  insert into public.listing_request_early_review_flags (
    listing_request_id,
    flagged_by_user_id,
    category,
    note
  )
  values (
    p_request_id,
    auth.uid(),
    p_category,
    clean_note
  )
  returning id into new_flag_id;

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
      'An early review was requested for this project. Made for Stream will review and decide.'
    );
  end if;

  return query
  select new_flag_id, 'pending'::text;
end;
$$;

revoke all on function public.flag_listing_request_for_early_review(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.flag_listing_request_for_early_review(uuid, text, text)
to authenticated;

-- Admin approves or declines. Approval is what
-- admin_close_listing_request_for_non_response's early-review path checks
-- for -- it does not itself close anything.
create or replace function public.admin_decide_listing_request_early_review(
  p_flag_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns table (
  flag_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  flag_row public.listing_request_early_review_flags%rowtype;
  clean_decision_note text := nullif(btrim(coalesce(p_decision_note, '')), '');
  decide_time timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'declined') then
    raise exception
      'Decision must be approved or declined.'
      using errcode = '22023';
  end if;

  select *
  into flag_row
  from public.listing_request_early_review_flags
  where listing_request_early_review_flags.id = p_flag_id
    and listing_request_early_review_flags.status = 'pending'
  for update;

  if not found then
    raise exception
      'This early review request is not pending.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_early_review_flags
  set
    status = p_decision,
    reviewed_by_admin_user_id = auth.uid(),
    reviewed_at = decide_time,
    decision_note = clean_decision_note
  where id = p_flag_id;

  return query
  select p_flag_id, p_decision;
end;
$$;

revoke all on function public.admin_decide_listing_request_early_review(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.admin_decide_listing_request_early_review(uuid, text, text)
to authenticated;

notify pgrst, 'reload schema';
