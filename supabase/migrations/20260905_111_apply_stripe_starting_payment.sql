-- Apply a verified Stripe starting payment to the existing
-- CreatorHub agreement/payment workflow.
--
-- This function is intentionally service-role only.
-- The browser cannot directly mark project work as paid/unlocked.

create or replace function
public.apply_paid_listing_request_starting_payment(
  p_listing_request_payment_id uuid
)
returns table (
  listing_request_payment_id uuid,
  payment_schedule_item_id uuid,
  agreement_id uuid,
  listing_request_id uuid,
  workflow_applied boolean,
  work_unlocked boolean,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  stripe_payment_row
    public.listing_request_payments%rowtype;

  schedule_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  payment_confirmed_at timestamptz;

  remaining_starting_payment_count integer := 0;

  conversation_id uuid;

  did_apply_workflow boolean := false;
  did_unlock_work boolean := false;
begin
  select *
  into stripe_payment_row
  from public.listing_request_payments
  where listing_request_payments.id =
    p_listing_request_payment_id
  for update;

  if not found then
    raise exception
      'Stripe payment % was not found.',
      p_listing_request_payment_id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.status <> 'paid' then
    raise exception
      'Stripe payment % has not been confirmed as paid.',
      stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_type <> 'starting_payment' then
    raise exception
      'Stripe payment % is not a starting payment.',
      stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_schedule_item_id is null then
    raise exception
      'Stripe starting payment % is missing its payment schedule item.',
      stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  payment_confirmed_at :=
    coalesce(
      stripe_payment_row.paid_at,
      now()
    );

  select *
  into schedule_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
      stripe_payment_row.payment_schedule_item_id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_work_starts'
  for update;

  if not found then
    raise exception
      'The starting-payment schedule item could not be found.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      schedule_row.agreement_id
    and listing_request_agreements.listing_request_id =
      stripe_payment_row.listing_request_id
    and listing_request_agreements.buyer_user_id =
      stripe_payment_row.payer_user_id
    and listing_request_agreements.creator_user_id =
      stripe_payment_row.creator_user_id
    and listing_request_agreements.status =
      'buyer_accepted'
  for update;

  if not found then
    raise exception
      'The accepted project agreement for this Stripe payment could not be found.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
        agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  -- Stripe webhook retries are expected.
  -- If this schedule item is already paid, leave it alone.
  if schedule_row.status <> 'paid' then
    if schedule_row.status <> 'payment_required' then
      raise exception
        'This starting-payment schedule item is not awaiting payment.'
        using errcode = 'P0001';
    end if;

    update public.listing_request_payment_schedule_items
    set
      status = 'paid',
      paid_at = coalesce(
        listing_request_payment_schedule_items.paid_at,
        payment_confirmed_at
      )
    where listing_request_payment_schedule_items.id =
      schedule_row.id;

    did_apply_workflow := true;
  end if;

  -- Do not unlock work until every required starting-payment
  -- schedule item has been paid.
  select count(*)
  into remaining_starting_payment_count
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_work_starts'
    and listing_request_payment_schedule_items.amount > 0
    and listing_request_payment_schedule_items.status in (
      'pending',
      'payment_required'
    );

  if remaining_starting_payment_count = 0 then
    -- Only announce/unlock on the transition into the paid state.
    if agreement_row.starting_payment_status <> 'paid' then
      update public.listing_request_agreements
      set
        starting_payment_status = 'paid',
        estimated_start_at = coalesce(
          estimated_start_at,
          payment_confirmed_at
        )
      where listing_request_agreements.id =
        agreement_row.id;

      update public.listing_request_timeline_holds
      set
        ended_at = payment_confirmed_at
      where listing_request_timeline_holds.agreement_id =
          agreement_row.id
        and listing_request_timeline_holds.reason =
          'starting_payment_pending'
        and listing_request_timeline_holds.ended_at
          is null;

      did_unlock_work := true;
      did_apply_workflow := true;

      select conversations.id
      into conversation_id
      from public.conversations
      where conversations.listing_request_id =
        agreement_row.listing_request_id
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
          stripe_payment_row.payer_user_id,
          'system',
          'Stripe confirmed the required starting payment. Work may now begin.'
        );
      end if;
    else
      did_unlock_work := true;
    end if;
  end if;

  return query
  select
    stripe_payment_row.id,
    schedule_row.id,
    agreement_row.id,
    agreement_row.listing_request_id,
    did_apply_workflow,
    did_unlock_work,
    payment_confirmed_at;
end;
$$;


-- Only the backend service role may apply Stripe-confirmed payments.
revoke all
on function
public.apply_paid_listing_request_starting_payment(uuid)
from public;

revoke all
on function
public.apply_paid_listing_request_starting_payment(uuid)
from anon;

revoke all
on function
public.apply_paid_listing_request_starting_payment(uuid)
from authenticated;

grant execute
on function
public.apply_paid_listing_request_starting_payment(uuid)
to service_role;