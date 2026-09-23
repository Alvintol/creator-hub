-- Sprint 4 (launch-scope.md section 5.2): cancellation after any payment has
-- been collected. Never a unilateral act -- a proposal with a settlement.
--
-- Flow:
--   1. Either party opens a proposal with a reason. If the creator opens it,
--      their itemised per-payment earned-value statement is attached
--      immediately. If the buyer opens it, the creator has three business
--      days to provide it (statement_due_at, recorded at open).
--   2. The creator's itemised statement is authoritative -- it is the only
--      one "cancel_listing_request_before_payment"-style downstream
--      processing ever acts on. It must cover every paid payment on the
--      request.
--   3. The buyer accepts or disputes the creator's statement.
--   4. On acceptance: unpaid schedule items and every other non-terminal
--      workflow object cancel, the request moves to cancelled, and every
--      unearned cents amount on a paid payment is flagged for the refund
--      engine (Sprint 5) rather than refunded here -- "cancellation never
--      creates a new charge," and this sprint issues no refunds either.
--   5. On dispute: the proposal's status is itself the Tier 2 support-queue
--      signal (REF-001's pattern -- no separate queue table). Made for
--      Stream decides by hand, under Refund Policy section 9.

create table if not exists public.listing_request_cancellation_proposals (
  id uuid primary key default gen_random_uuid(),

  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,
  agreement_id uuid not null references public.listing_request_agreements(id) on delete cascade,

  creator_user_id uuid not null,
  buyer_user_id uuid not null,
  proposed_by_user_id uuid not null,

  status text not null default 'pending_creator_statement' check (
    status in (
      'pending_creator_statement',
      'pending_buyer_response',
      'accepted',
      'disputed'
    )
  ),

  reason text not null check (
    char_length(btrim(reason)) >= 10
    and char_length(btrim(reason)) <= 1000
  ),

  statement_due_at timestamptz not null,
  statement_submitted_at timestamptz null,
  statement_submitted_by_user_id uuid null,

  buyer_response text null check (
    buyer_response is null
    or buyer_response in ('accepted', 'disputed')
  ),
  buyer_response_reason text null check (
    buyer_response_reason is null
    or (
      char_length(btrim(buyer_response_reason)) >= 10
      and char_length(btrim(buyer_response_reason)) <= 2000
    )
  ),
  responded_at timestamptz null,
  accepted_at timestamptz null,
  disputed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    proposed_by_user_id = creator_user_id
    or proposed_by_user_id = buyer_user_id
  ),

  check (
    (
      statement_submitted_at is null
      and statement_submitted_by_user_id is null
    )
    or (
      statement_submitted_at is not null
      and statement_submitted_by_user_id is not null
    )
  ),

  check (
    (
      status = 'accepted'
      and buyer_response = 'accepted'
      and responded_at is not null
      and accepted_at is not null
      and disputed_at is null
      and statement_submitted_at is not null
    )
    or (
      status = 'disputed'
      and buyer_response = 'disputed'
      and responded_at is not null
      and disputed_at is not null
      and accepted_at is null
    )
    or (
      status in ('pending_creator_statement', 'pending_buyer_response')
      and buyer_response is null
      and responded_at is null
      and accepted_at is null
      and disputed_at is null
    )
  )
);

-- Only one open cancellation proposal per request at a time.
create unique index if not exists
listing_request_cancellation_proposals_one_open_idx
on public.listing_request_cancellation_proposals(listing_request_id)
where status in ('pending_creator_statement', 'pending_buyer_response');

create index if not exists
listing_request_cancellation_proposals_request_idx
on public.listing_request_cancellation_proposals(listing_request_id);

create index if not exists
listing_request_cancellation_proposals_agreement_idx
on public.listing_request_cancellation_proposals(agreement_id);

create index if not exists
listing_request_cancellation_proposals_buyer_idx
on public.listing_request_cancellation_proposals(buyer_user_id);

create index if not exists
listing_request_cancellation_proposals_creator_idx
on public.listing_request_cancellation_proposals(creator_user_id);

-- Tier 2 support-queue index -- see docs/support/requests/cancellation.md.
create index if not exists
listing_request_cancellation_proposals_disputed_idx
on public.listing_request_cancellation_proposals(disputed_at desc)
where status = 'disputed';

drop trigger if exists
listing_request_cancellation_proposals_set_updated_at
on public.listing_request_cancellation_proposals;

create trigger
listing_request_cancellation_proposals_set_updated_at
before update on public.listing_request_cancellation_proposals
for each row
execute function public.set_updated_at();

-- The itemised, per-payment earned-value line items. Only the operative
-- (is_operative = true) rows are the creator's binding statement that
-- acceptance acts on; a buyer's opening claim (when they are the one who
-- proposed cancellation) is recorded with is_operative = false so it stays
-- in the audit trail without being mistaken for the authoritative figure.
create table if not exists public.listing_request_cancellation_proposal_items (
  id uuid primary key default gen_random_uuid(),

  proposal_id uuid not null references public.listing_request_cancellation_proposals(id) on delete cascade,
  payment_id uuid not null references public.listing_request_payments(id),
  milestone_id uuid null references public.listing_request_milestones(id),

  authored_by_user_id uuid not null,
  is_operative boolean not null default false,

  label text not null check (
    char_length(btrim(label)) >= 2
    and char_length(btrim(label)) <= 160
  ),

  paid_amount_cents integer not null check (paid_amount_cents > 0),
  earned_amount_cents integer not null check (earned_amount_cents >= 0),
  unearned_amount_cents integer not null check (unearned_amount_cents >= 0),

  note text null check (
    note is null or char_length(btrim(note)) <= 2000
  ),

  -- Set when the proposal is accepted and this line has money to give back.
  -- Sprint 5's refund engine consumes rows where this is set and
  -- refunded_at is still null; it is the one who sets refunded_at.
  flagged_for_refund_at timestamptz null,
  refunded_at timestamptz null,

  created_at timestamptz not null default now(),

  check (earned_amount_cents + unearned_amount_cents = paid_amount_cents),
  check (refunded_at is null or flagged_for_refund_at is not null)
);

-- At most one operative line per payment per proposal at any time.
create unique index if not exists
listing_request_cancellation_proposal_items_operative_idx
on public.listing_request_cancellation_proposal_items(proposal_id, payment_id)
where is_operative = true;

create index if not exists
listing_request_cancellation_proposal_items_proposal_idx
on public.listing_request_cancellation_proposal_items(proposal_id);

create index if not exists
listing_request_cancellation_proposal_items_payment_idx
on public.listing_request_cancellation_proposal_items(payment_id);

-- Refund-engine pickup index (Sprint 5).
create index if not exists
listing_request_cancellation_proposal_items_unrefunded_idx
on public.listing_request_cancellation_proposal_items(flagged_for_refund_at)
where flagged_for_refund_at is not null and refunded_at is null;

alter table public.listing_request_cancellation_proposals enable row level security;
alter table public.listing_request_cancellation_proposal_items enable row level security;

drop policy if exists "cancellation proposal participants can read"
on public.listing_request_cancellation_proposals;

create policy "cancellation proposal participants can read"
on public.listing_request_cancellation_proposals
for select
to authenticated
using (
  buyer_user_id = auth.uid()
  or creator_user_id = auth.uid()
);

drop policy if exists "admins can read cancellation proposals"
on public.listing_request_cancellation_proposals;

create policy "admins can read cancellation proposals"
on public.listing_request_cancellation_proposals
for select
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "cancellation proposal item participants can read"
on public.listing_request_cancellation_proposal_items;

create policy "cancellation proposal item participants can read"
on public.listing_request_cancellation_proposal_items
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_request_cancellation_proposals
    where listing_request_cancellation_proposals.id =
        listing_request_cancellation_proposal_items.proposal_id
      and (
        listing_request_cancellation_proposals.buyer_user_id = auth.uid()
        or listing_request_cancellation_proposals.creator_user_id = auth.uid()
      )
  )
);

drop policy if exists "admins can read cancellation proposal items"
on public.listing_request_cancellation_proposal_items;

create policy "admins can read cancellation proposal items"
on public.listing_request_cancellation_proposal_items
for select
to authenticated
using (public.is_admin_user(auth.uid()));

-- No insert/update/delete policy on either table for any client role --
-- every write goes through the security definer RPCs below, matching
-- listing_request_agreements and every other workflow table in this schema.

create or replace function public.add_business_days(
  p_start timestamptz,
  p_days integer
)
returns timestamptz
language plpgsql
stable
as $$
declare
  remaining integer := p_days;
  cursor_ts timestamptz := p_start;
begin
  if p_days <= 0 then
    return p_start;
  end if;

  while remaining > 0 loop
    cursor_ts := cursor_ts + interval '1 day';

    -- ISO day of week: 1 = Monday .. 7 = Sunday.
    if extract(isodow from cursor_ts) < 6 then
      remaining := remaining - 1;
    end if;
  end loop;

  return cursor_ts;
end;
$$;

revoke execute on function public.add_business_days(timestamptz, integer)
from public, anon, authenticated;

-- Internal helper shared by propose_listing_request_cancellation (when the
-- creator is the one opening the proposal) and
-- submit_listing_request_cancellation_statement. Writes the operative,
-- binding itemised statement and enforces that it covers every paid
-- payment on the request. Never callable directly by a client.
create or replace function public.apply_listing_request_cancellation_statement(
  p_proposal_id uuid,
  p_listing_request_id uuid,
  p_creator_user_id uuid,
  p_items jsonb,
  p_statement_time timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_payment_id uuid;
  item_milestone_id uuid;
  item_label text;
  item_earned_cents integer;
  item_note text;
  payment_row public.listing_request_payments%rowtype;
  covered_payment_ids uuid[] := array[]::uuid[];
  missing_payment_ids uuid[];
begin
  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 then
    raise exception
      'A cancellation statement must include at least one itemised payment.'
      using errcode = '22023';
  end if;

  update public.listing_request_cancellation_proposal_items
  set is_operative = false
  where proposal_id = p_proposal_id
    and is_operative = true;

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_payment_id := nullif(item ->> 'payment_id', '')::uuid;
    item_milestone_id := nullif(item ->> 'milestone_id', '')::uuid;
    item_label := btrim(coalesce(item ->> 'label', ''));
    item_earned_cents := (item ->> 'earned_amount_cents')::integer;
    item_note := nullif(btrim(coalesce(item ->> 'note', '')), '');

    if item_payment_id is null then
      raise exception
        'Each cancellation statement item must reference a payment_id.'
        using errcode = '22023';
    end if;

    if item_label = '' or char_length(item_label) > 160 then
      raise exception
        'Each cancellation statement item needs a label of up to 160 characters.'
        using errcode = '22023';
    end if;

    if item_earned_cents is null or item_earned_cents < 0 then
      raise exception
        'Each cancellation statement item needs a non-negative earned_amount_cents.'
        using errcode = '22023';
    end if;

    if item_payment_id = any(covered_payment_ids) then
      raise exception
        'Payment % is listed more than once in this statement.', item_payment_id
        using errcode = '22023';
    end if;

    select *
    into payment_row
    from public.listing_request_payments
    where listing_request_payments.id = item_payment_id
      and listing_request_payments.listing_request_id = p_listing_request_id
      and listing_request_payments.status = 'paid'
    for update;

    if not found then
      raise exception
        'Payment % is not a paid payment on this request.', item_payment_id
        using errcode = 'P0001';
    end if;

    if item_earned_cents > payment_row.base_amount_cents then
      raise exception
        'Earned amount for payment % cannot exceed the % cents actually paid.',
        item_payment_id, payment_row.base_amount_cents
        using errcode = '22023';
    end if;

    covered_payment_ids := covered_payment_ids || item_payment_id;

    insert into public.listing_request_cancellation_proposal_items (
      proposal_id,
      payment_id,
      milestone_id,
      authored_by_user_id,
      is_operative,
      label,
      paid_amount_cents,
      earned_amount_cents,
      unearned_amount_cents,
      note
    )
    values (
      p_proposal_id,
      item_payment_id,
      item_milestone_id,
      p_creator_user_id,
      true,
      item_label,
      payment_row.base_amount_cents,
      item_earned_cents,
      payment_row.base_amount_cents - item_earned_cents,
      item_note
    );
  end loop;

  select array_agg(listing_request_payments.id)
  into missing_payment_ids
  from public.listing_request_payments
  where listing_request_payments.listing_request_id = p_listing_request_id
    and listing_request_payments.status = 'paid'
    and not (listing_request_payments.id = any(covered_payment_ids));

  if missing_payment_ids is not null then
    raise exception
      'The itemised statement must cover every paid payment on this request. Missing payment ids: %',
      missing_payment_ids
      using errcode = '22023';
  end if;

  update public.listing_request_cancellation_proposals
  set
    statement_submitted_at = p_statement_time,
    statement_submitted_by_user_id = p_creator_user_id,
    status = 'pending_buyer_response',
    updated_at = p_statement_time
  where id = p_proposal_id;
end;
$$;

revoke execute on function public.apply_listing_request_cancellation_statement(
  uuid, uuid, uuid, jsonb, timestamptz
) from public, anon, authenticated;

-- Step 1: either party opens a cancellation proposal.
create or replace function public.propose_listing_request_cancellation(
  p_request_id uuid,
  p_reason text,
  p_items jsonb default null
)
returns table (
  proposal_id uuid,
  status text,
  statement_due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_requests%rowtype;
  agreement_row public.listing_request_agreements%rowtype;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  open_time timestamptz := now();
  due_at timestamptz;
  new_proposal_id uuid;
  is_creator boolean;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to propose a cancellation.'
      using errcode = '42501';
  end if;

  if clean_reason is null
    or char_length(clean_reason) < 10
    or char_length(clean_reason) > 1000 then
    raise exception
      'A cancellation reason of between 10 and 1000 characters is required.'
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
      'Only an accepted request can have a cancellation proposed.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_request_payments
    where listing_request_payments.listing_request_id = p_request_id
      and listing_request_payments.status = 'paid'
  ) then
    raise exception
      'No payment has been collected on this request yet. Use cancel_listing_request_before_payment instead.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_cancellation_proposals
    where listing_request_cancellation_proposals.listing_request_id = p_request_id
      and listing_request_cancellation_proposals.status in (
        'pending_creator_statement',
        'pending_buyer_response'
      )
  ) then
    raise exception
      'A cancellation proposal is already open for this request.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.listing_request_id = p_request_id
    and listing_request_agreements.status = 'buyer_accepted'
  order by listing_request_agreements.version_number desc
  limit 1
  for update;

  if not found then
    raise exception
      'No accepted agreement was found for this request.'
      using errcode = 'P0001';
  end if;

  is_creator := auth.uid() = request_row.creator_user_id;
  due_at := public.add_business_days(open_time, 3);

  if is_creator and p_items is null then
    raise exception
      'The creator must include an itemised earned-value statement when opening a cancellation.'
      using errcode = '22023';
  end if;

  if not is_creator and p_items is not null then
    raise exception
      'Only the creator provides the itemised earned-value statement. The buyer opens a cancellation with a reason only; the creator then has three business days to submit it.'
      using errcode = '22023';
  end if;

  insert into public.listing_request_cancellation_proposals (
    listing_request_id,
    agreement_id,
    creator_user_id,
    buyer_user_id,
    proposed_by_user_id,
    status,
    reason,
    statement_due_at
  )
  values (
    p_request_id,
    agreement_row.id,
    request_row.creator_user_id,
    request_row.buyer_user_id,
    auth.uid(),
    'pending_creator_statement',
    clean_reason,
    due_at
  )
  returning id into new_proposal_id;

  if is_creator then
    perform public.apply_listing_request_cancellation_statement(
      new_proposal_id,
      p_request_id,
      request_row.creator_user_id,
      p_items,
      open_time
    );
  end if;

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
        'A cancellation was proposed: %s. %s',
        clean_reason,
        case
          when is_creator then
            'An itemised earned-value statement is attached; the buyer can now accept or dispute it.'
          else
            format(
              'The creator has until %s to provide an itemised earned-value statement.',
              to_char(due_at, 'YYYY-MM-DD HH24:MI TZ')
            )
        end
      )
    );
  end if;

  return query
  select
    new_proposal_id,
    proposals.status,
    proposals.statement_due_at
  from public.listing_request_cancellation_proposals as proposals
  where proposals.id = new_proposal_id;
end;
$$;

revoke all on function public.propose_listing_request_cancellation(uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function public.propose_listing_request_cancellation(uuid, text, jsonb)
to authenticated;

-- Step 2: the creator's itemised statement, when the buyer was the one who
-- opened the proposal.
create or replace function public.submit_listing_request_cancellation_statement(
  p_proposal_id uuid,
  p_items jsonb
)
returns table (
  proposal_id uuid,
  status text,
  statement_submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row public.listing_request_cancellation_proposals%rowtype;
  submit_time timestamptz := now();
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to submit a cancellation statement.'
      using errcode = '42501';
  end if;

  select *
  into proposal_row
  from public.listing_request_cancellation_proposals
  where listing_request_cancellation_proposals.id = p_proposal_id
    and listing_request_cancellation_proposals.creator_user_id = auth.uid()
    and listing_request_cancellation_proposals.status = 'pending_creator_statement'
  for update;

  if not found then
    raise exception
      'This cancellation proposal is not awaiting your statement.'
      using errcode = 'P0001';
  end if;

  perform public.apply_listing_request_cancellation_statement(
    p_proposal_id,
    proposal_row.listing_request_id,
    auth.uid(),
    p_items,
    submit_time
  );

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = proposal_row.listing_request_id
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
      'The creator submitted an itemised earned-value statement. The buyer can now accept or dispute it.'
    );
  end if;

  return query
  select
    p_proposal_id,
    'pending_buyer_response'::text,
    submit_time;
end;
$$;

revoke all on function public.submit_listing_request_cancellation_statement(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.submit_listing_request_cancellation_statement(uuid, jsonb)
to authenticated;

-- Step 3: the buyer accepts or disputes the creator's itemised statement.
create or replace function public.respond_listing_request_cancellation_proposal(
  p_proposal_id uuid,
  p_response text,
  p_response_reason text default null
)
returns table (
  proposal_id uuid,
  status text,
  request_status text,
  payments_to_expire uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row public.listing_request_cancellation_proposals%rowtype;
  clean_response text := btrim(coalesce(p_response, ''));
  clean_reason text := nullif(btrim(coalesce(p_response_reason, '')), '');
  response_time timestamptz := now();
  expiring_payment_ids uuid[];
  conversation_id uuid;
  final_request_status text;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to respond to a cancellation proposal.'
      using errcode = '42501';
  end if;

  if clean_response not in ('accepted', 'disputed') then
    raise exception
      'Response must be accepted or disputed.'
      using errcode = '22023';
  end if;

  if clean_response = 'disputed'
    and (clean_reason is null or char_length(clean_reason) < 10) then
    raise exception
      'A dispute reason of at least 10 characters is required.'
      using errcode = '22023';
  end if;

  select *
  into proposal_row
  from public.listing_request_cancellation_proposals
  where listing_request_cancellation_proposals.id = p_proposal_id
    and listing_request_cancellation_proposals.buyer_user_id = auth.uid()
    and listing_request_cancellation_proposals.status = 'pending_buyer_response'
  for update;

  if not found then
    raise exception
      'This cancellation proposal is not awaiting your response.'
      using errcode = 'P0001';
  end if;

  if clean_response = 'disputed' then
    update public.listing_request_cancellation_proposals
    set
      status = 'disputed',
      buyer_response = 'disputed',
      buyer_response_reason = clean_reason,
      responded_at = response_time,
      disputed_at = response_time,
      updated_at = response_time
    where id = p_proposal_id;

    select conversations.id
    into conversation_id
    from public.conversations
    where conversations.listing_request_id = proposal_row.listing_request_id
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
          'The buyer disputed the cancellation statement: %s. Made for Stream will review and decide.',
          clean_reason
        )
      );
    end if;

    -- Disputing does not change the request's own status -- it stays
    -- 'accepted' (propose_listing_request_cancellation already required
    -- that) while Made for Stream reviews.
    return query
    select p_proposal_id, 'disputed'::text, 'accepted'::text, array[]::uuid[];

    return;
  end if;

  -- Accepted.
  update public.listing_request_cancellation_proposals
  set
    status = 'accepted',
    buyer_response = 'accepted',
    buyer_response_reason = clean_reason,
    responded_at = response_time,
    accepted_at = response_time,
    updated_at = response_time
  where id = p_proposal_id;

  update public.listing_request_cancellation_proposal_items
  set flagged_for_refund_at = response_time
  where proposal_id = p_proposal_id
    and is_operative = true
    and unearned_amount_cents > 0;

  update public.listing_request_agreements
  set
    status = 'cancelled',
    cancelled_at = response_time
  where id = proposal_row.agreement_id;

  update public.listing_request_payment_schedule_items
  set
    status = 'cancelled',
    updated_at = response_time
  where listing_request_payment_schedule_items.agreement_id = proposal_row.agreement_id
    and listing_request_payment_schedule_items.status in ('pending', 'payment_required');

  update public.listing_request_timeline_holds
  set ended_at = response_time
  where listing_request_timeline_holds.agreement_id = proposal_row.agreement_id
    and listing_request_timeline_holds.ended_at is null;

  update public.listing_request_milestones
  set
    status = 'cancelled',
    cancelled_at = response_time,
    updated_at = response_time
  where listing_request_milestones.listing_request_id = proposal_row.listing_request_id
    and listing_request_milestones.status not in ('paid', 'cancelled');

  update public.listing_request_change_orders
  set
    status = 'cancelled',
    cancelled_at = response_time,
    updated_at = response_time
  where listing_request_change_orders.listing_request_id = proposal_row.listing_request_id
    and listing_request_change_orders.status in ('draft', 'sent');

  update public.listing_request_final_deliveries
  set
    status = 'cancelled',
    cancelled_at = response_time,
    updated_at = response_time
  where listing_request_final_deliveries.listing_request_id = proposal_row.listing_request_id
    and listing_request_final_deliveries.status in ('draft', 'submitted', 'revision_requested');

  select array_agg(listing_request_payments.id)
  into expiring_payment_ids
  from public.listing_request_payments
  where listing_request_payments.listing_request_id = proposal_row.listing_request_id
    and listing_request_payments.status in ('requires_checkout', 'checkout_opened');

  update public.listing_request_payments
  set
    status = 'cancelled',
    cancelled_at = response_time,
    updated_at = response_time
  where listing_request_payments.listing_request_id = proposal_row.listing_request_id
    and listing_request_payments.status in ('requires_checkout', 'checkout_opened');

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = proposal_row.listing_request_id
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
      'The buyer accepted the cancellation statement. Unpaid items are cancelled and any unearned prepaid amounts are flagged for refund.'
    );
  end if;

  -- Fires listing_requests_close_conversation_when_cancelled from
  -- 20260922_122, which adds its own read-only notice after the message
  -- above.
  update public.listing_requests
  set
    status = 'cancelled',
    cancelled_at = response_time,
    cancelled_by_user_id = auth.uid(),
    cancellation_reason = proposal_row.reason
  where listing_requests.id = proposal_row.listing_request_id;

  final_request_status := 'cancelled';

  return query
  select
    p_proposal_id,
    'accepted'::text,
    final_request_status,
    coalesce(expiring_payment_ids, array[]::uuid[]);
end;
$$;

revoke all on function public.respond_listing_request_cancellation_proposal(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.respond_listing_request_cancellation_proposal(uuid, text, text)
to authenticated;

notify pgrst, 'reload schema';
