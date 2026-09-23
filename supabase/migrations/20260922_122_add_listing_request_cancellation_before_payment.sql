-- Sprint 4 (launch-scope.md section 5.1): the unilateral, pre-payment
-- cancellation path. Either party may cancel an accepted request before any
-- payment has been collected -- no settlement, no review.

alter table public.listing_requests
add column if not exists cancelled_at timestamptz null;

alter table public.listing_requests
add column if not exists cancelled_by_user_id uuid null;

alter table public.listing_requests
add column if not exists cancellation_reason text null;

alter table public.listing_requests
drop constraint if exists listing_requests_cancellation_reason_check;

alter table public.listing_requests
add constraint listing_requests_cancellation_reason_check
check (
  cancellation_reason is null
  or (
    char_length(btrim(cancellation_reason)) >= 10
    and char_length(btrim(cancellation_reason)) <= 1000
  )
);

alter table public.listing_requests
drop constraint if exists listing_requests_status_check;

alter table public.listing_requests
add constraint listing_requests_status_check
check (
  status in (
    'submitted',
    'accepted',
    'completed',
    'declined',
    'archived',
    'cancelled'
  )
);

-- Same pairing pattern as the completed-metadata check in 20260611_093.
alter table public.listing_requests
drop constraint if exists listing_requests_cancelled_metadata_check;

alter table public.listing_requests
add constraint listing_requests_cancelled_metadata_check
check (
  (
    status = 'cancelled'
    and cancelled_at is not null
    and cancelled_by_user_id is not null
  )
  or
  (
    status <> 'cancelled'
    and cancelled_at is null
    and cancelled_by_user_id is null
  )
);

create index if not exists
listing_requests_cancelled_at_idx
on public.listing_requests(cancelled_at desc)
where status = 'cancelled';

-- Conversation stays open through cancellation, then closes the same way a
-- completed request's conversation closes (20260611_094) -- read-only, with
-- a system message and a conversation_closed event, but with a
-- "not_moving_forward" reason instead of "project_completed".
create or replace function
public.close_conversation_when_listing_request_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;

  cancellation_time timestamptz :=
    coalesce(new.cancelled_at, now());

  cancellation_actor_user_id uuid :=
    coalesce(
      new.cancelled_by_user_id,
      new.buyer_user_id
    );

  reason_details text :=
    coalesce(
      new.cancellation_reason,
      'The request was cancelled before any payment was collected.'
    );
begin
  if old.status is not distinct from new.status
    or new.status <> 'cancelled' then
    return new;
  end if;

  select *
  into conversation_row
  from public.conversations
  where conversations.listing_request_id = new.id
  for update;

  if not found then
    return new;
  end if;

  if conversation_row.status <> 'open' then
    return new;
  end if;

  update public.conversations
  set
    status = 'closed',
    closed_at = cancellation_time,
    closed_by_user_id =
      cancellation_actor_user_id,
    closed_reason_code =
      'not_moving_forward',
    closed_reason_details =
      reason_details,
    updated_at = now()
  where conversations.id =
    conversation_row.id;

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
  values (
    conversation_row.id,
    cancellation_actor_user_id,
    'system',
    'This request has been cancelled. The conversation is now read-only.'
  );

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_row.id,
    cancellation_actor_user_id,
    'conversation_closed',
    jsonb_build_object(
      'reason_code', 'not_moving_forward',
      'reason_details', reason_details,
      'listing_request_id', new.id,
      'request_status', new.status,
      'cancelled_at', cancellation_time
    )
  );

  return new;
end;
$$;

drop trigger if exists
listing_requests_close_conversation_when_cancelled
on public.listing_requests;

create trigger
listing_requests_close_conversation_when_cancelled
after update of status
on public.listing_requests
for each row
when (
  old.status is distinct from new.status
  and new.status = 'cancelled'
)
execute function
public.close_conversation_when_listing_request_cancelled();

-- Trigger-only; inert if called directly, but Supabase grants EXECUTE on new
-- public-schema functions to anon/authenticated independently of the PUBLIC
-- pseudo-role, so "revoke ... from public" alone does not close it (see
-- 20260922_119's audit note).
revoke execute on function
public.close_conversation_when_listing_request_cancelled()
from public, anon, authenticated;

-- The unilateral pre-payment cancellation RPC. Either the buyer or the
-- creator may call it while the request is accepted and no payment has
-- reached (or passed through) a collected state. Cancels the request, the
-- active agreement, every non-terminal schedule item / milestone / change
-- order / final delivery, and every payment still waiting on checkout.
-- Returns the ids of any payments that had an open Stripe checkout session
-- so the caller can expire them through the API (this RPC only writes to
-- the database; it cannot call Stripe).
drop function if exists
public.cancel_listing_request_before_payment(uuid, text);

create or replace function
public.cancel_listing_request_before_payment(
  p_request_id uuid,
  p_reason text
)
returns table (
  listing_request_id uuid,
  request_status text,
  cancelled_at timestamptz,
  agreement_id uuid,
  payments_to_expire uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row
    public.listing_requests%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  clean_reason text :=
    nullif(btrim(coalesce(p_reason, '')), '');

  cancellation_time timestamptz := now();

  expiring_payment_ids uuid[];

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to cancel a request.'
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
      'Only an accepted request can be cancelled through this unilateral path.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_payments
    where listing_request_payments.listing_request_id = p_request_id
      and listing_request_payments.status in (
        'paid',
        'processing',
        'refunded',
        'partially_refunded',
        'disputed'
      )
  ) then
    raise exception
      'A payment has already been collected on this request. Use the post-payment cancellation proposal instead.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.listing_request_id = p_request_id
    and listing_request_agreements.status in (
      'draft',
      'sent',
      'buyer_accepted'
    )
  order by listing_request_agreements.version_number desc
  limit 1
  for update;

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
        'This request was cancelled before any payment was collected: %s',
        clean_reason
      )
    );
  end if;

  -- Fires listing_requests_close_conversation_when_cancelled, which closes
  -- the conversation with its own read-only notice after this message.
  update public.listing_requests
  set
    status = 'cancelled',
    cancelled_at = cancellation_time,
    cancelled_by_user_id = auth.uid(),
    cancellation_reason = clean_reason
  where listing_requests.id = p_request_id;

  if agreement_row.id is not null then
    update public.listing_request_agreements
    set
      status = 'cancelled',
      cancelled_at = cancellation_time
    where listing_request_agreements.id = agreement_row.id;

    update public.listing_request_payment_schedule_items
    set
      status = 'cancelled',
      updated_at = cancellation_time
    where listing_request_payment_schedule_items.agreement_id = agreement_row.id
      and listing_request_payment_schedule_items.status in (
        'pending',
        'payment_required'
      );

    update public.listing_request_timeline_holds
    set ended_at = cancellation_time
    where listing_request_timeline_holds.agreement_id = agreement_row.id
      and listing_request_timeline_holds.ended_at is null;
  end if;

  update public.listing_request_milestones
  set
    status = 'cancelled',
    cancelled_at = cancellation_time,
    updated_at = cancellation_time
  where listing_request_milestones.listing_request_id = p_request_id
    and listing_request_milestones.status not in (
      'paid',
      'cancelled'
    );

  update public.listing_request_change_orders
  set
    status = 'cancelled',
    cancelled_at = cancellation_time,
    updated_at = cancellation_time
  where listing_request_change_orders.listing_request_id = p_request_id
    and listing_request_change_orders.status in (
      'draft',
      'sent'
    );

  update public.listing_request_final_deliveries
  set
    status = 'cancelled',
    cancelled_at = cancellation_time,
    updated_at = cancellation_time
  where listing_request_final_deliveries.listing_request_id = p_request_id
    and listing_request_final_deliveries.status in (
      'draft',
      'submitted',
      'revision_requested'
    );

  select array_agg(listing_request_payments.id)
  into expiring_payment_ids
  from public.listing_request_payments
  where listing_request_payments.listing_request_id = p_request_id
    and listing_request_payments.status in (
      'requires_checkout',
      'checkout_opened'
    );

  update public.listing_request_payments
  set
    status = 'cancelled',
    cancelled_at = cancellation_time,
    updated_at = cancellation_time
  where listing_request_payments.listing_request_id = p_request_id
    and listing_request_payments.status in (
      'requires_checkout',
      'checkout_opened'
    );

  return query
  select
    p_request_id,
    'cancelled'::text,
    cancellation_time,
    agreement_row.id,
    coalesce(expiring_payment_ids, array[]::uuid[]);
end;
$$;

revoke all on function
public.cancel_listing_request_before_payment(uuid, text)
from public, anon;

grant execute on function
public.cancel_listing_request_before_payment(uuid, text)
to authenticated;

notify pgrst, 'reload schema';
