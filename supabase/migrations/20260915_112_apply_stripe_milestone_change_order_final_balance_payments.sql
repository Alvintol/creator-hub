-- Extends the Stripe-confirmed payment workflow (109/110/111) to the three
-- payment types that were left as explicit stubs in
-- applyPaidListingRequestPaymentWorkflow (api/server.js):
-- milestone_payment, change_order_payment, final_balance.
--
-- Each function mirrors the equivalent existing admin-confirm RPC
-- (101 milestone, 087 change-order, 092 final-balance) so the two
-- confirmation paths -- Stripe-verified and admin manual override --
-- converge on identical project-state transitions. The only structural
-- difference from the admin RPCs is what it should be: no auth.uid()/role
-- check (there is no signed-in admin in a webhook call), and the lookup
-- starts from the already-paid listing_request_payments row instead of a
-- bare payment_schedule_item_id, so it can verify payment_type, status,
-- and the connected agreement/listing_request all agree before touching
-- anything -- the same defensive check apply_paid_listing_request_starting_
-- payment (111) already does.
--
-- Like 111, these are service-role only: a browser must never be able to
-- unlock a milestone, apply a change order, or release a final balance by
-- calling one of these directly.

create or replace function
public.apply_paid_listing_request_milestone_payment(
  p_listing_request_payment_id uuid
)
returns table (
  listing_request_payment_id uuid,
  payment_schedule_item_id uuid,
  milestone_id uuid,
  agreement_id uuid,
  listing_request_id uuid,
  workflow_applied boolean,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  stripe_payment_row public.listing_request_payments%rowtype;
  schedule_row public.listing_request_payment_schedule_items%rowtype;
  milestone_row public.listing_request_milestones%rowtype;
  agreement_row public.listing_request_agreements%rowtype;

  payment_confirmed_at timestamptz;
  conversation_id uuid;
  did_apply_workflow boolean := false;
begin
  select * into stripe_payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_listing_request_payment_id
  for update;

  if not found then
    raise exception 'Stripe payment % was not found.', p_listing_request_payment_id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.status <> 'paid' then
    raise exception 'Stripe payment % has not been confirmed as paid.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_type <> 'milestone_payment' then
    raise exception 'Stripe payment % is not a milestone payment.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_schedule_item_id is null then
    raise exception 'Stripe milestone payment % is missing its payment schedule item.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  payment_confirmed_at := coalesce(stripe_payment_row.paid_at, now());

  select * into schedule_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id = stripe_payment_row.payment_schedule_item_id
    and listing_request_payment_schedule_items.payment_timing = 'due_at_milestone_approval'
  for update;

  if not found then
    raise exception 'The milestone schedule item could not be found.'
      using errcode = 'P0001';
  end if;

  select * into milestone_row
  from public.listing_request_milestones
  where listing_request_milestones.payment_schedule_item_id = schedule_row.id
  for update;

  if not found then
    raise exception 'The milestone for this Stripe payment could not be found.'
      using errcode = 'P0001';
  end if;

  select * into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = schedule_row.agreement_id
    and listing_request_agreements.listing_request_id = stripe_payment_row.listing_request_id
    and listing_request_agreements.buyer_user_id = stripe_payment_row.payer_user_id
    and listing_request_agreements.creator_user_id = stripe_payment_row.creator_user_id
    and listing_request_agreements.status = 'buyer_accepted'
    and listing_request_agreements.payment_structure = 'milestone_payments'
  for update;

  if not found then
    raise exception 'The accepted milestone agreement for this Stripe payment could not be found.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  -- Stripe webhook retries are expected -- leave an already-paid
  -- milestone alone rather than re-announcing it.
  if schedule_row.status <> 'paid' then
    if schedule_row.status <> 'payment_required' then
      raise exception 'This milestone payment is not awaiting confirmation.'
        using errcode = 'P0001';
    end if;

    update public.listing_request_payment_schedule_items
    set status = 'paid', paid_at = coalesce(paid_at, payment_confirmed_at)
    where listing_request_payment_schedule_items.id = schedule_row.id;

    update public.listing_request_milestones
    set status = 'paid', paid_at = payment_confirmed_at
    where listing_request_milestones.id = milestone_row.id;

    update public.listing_request_timeline_holds
    set ended_at = payment_confirmed_at
    where listing_request_timeline_holds.listing_request_id = milestone_row.listing_request_id
      and listing_request_timeline_holds.agreement_id = milestone_row.agreement_id
      and listing_request_timeline_holds.payment_schedule_item_id = schedule_row.id
      and listing_request_timeline_holds.reason = 'milestone_payment_pending'
      and listing_request_timeline_holds.ended_at is null;

    did_apply_workflow := true;

    select conversations.id into conversation_id
    from public.conversations
    where conversations.listing_request_id = milestone_row.listing_request_id
    limit 1;

    if conversation_id is not null then
      insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
      values (
        conversation_id,
        stripe_payment_row.payer_user_id,
        'system',
        format(
          'Stripe confirmed payment for milestone %s: %s. The creator can continue with the next milestone.',
          milestone_row.sort_order + 1,
          milestone_row.title
        )
      );
    end if;
  end if;

  return query
  select
    stripe_payment_row.id,
    schedule_row.id,
    milestone_row.id,
    agreement_row.id,
    agreement_row.listing_request_id,
    did_apply_workflow,
    payment_confirmed_at;
end;
$$;

revoke all on function public.apply_paid_listing_request_milestone_payment(uuid) from public;
revoke all on function public.apply_paid_listing_request_milestone_payment(uuid) from anon;
revoke all on function public.apply_paid_listing_request_milestone_payment(uuid) from authenticated;
grant execute on function public.apply_paid_listing_request_milestone_payment(uuid) to service_role;


create or replace function
public.apply_paid_listing_request_change_order_payment(
  p_listing_request_payment_id uuid
)
returns table (
  listing_request_payment_id uuid,
  payment_schedule_item_id uuid,
  change_order_id uuid,
  agreement_id uuid,
  listing_request_id uuid,
  workflow_applied boolean,
  hold_closed boolean,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  stripe_payment_row public.listing_request_payments%rowtype;
  schedule_row public.listing_request_payment_schedule_items%rowtype;
  agreement_row public.listing_request_agreements%rowtype;

  payment_confirmed_at timestamptz;
  conversation_id uuid;
  remaining_payment_count integer := 0;
  closed_hold_count integer := 0;
  did_apply_workflow boolean := false;
  did_close_hold boolean := false;
begin
  select * into stripe_payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_listing_request_payment_id
  for update;

  if not found then
    raise exception 'Stripe payment % was not found.', p_listing_request_payment_id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.status <> 'paid' then
    raise exception 'Stripe payment % has not been confirmed as paid.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_type <> 'change_order_payment' then
    raise exception 'Stripe payment % is not a change-order payment.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_schedule_item_id is null then
    raise exception 'Stripe change-order payment % is missing its payment schedule item.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  payment_confirmed_at := coalesce(stripe_payment_row.paid_at, now());

  select * into schedule_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id = stripe_payment_row.payment_schedule_item_id
    and listing_request_payment_schedule_items.change_order_id is not null
    and listing_request_payment_schedule_items.payment_timing = 'due_on_change_order_acceptance'
  for update;

  if not found then
    raise exception 'The change-order schedule item could not be found.'
      using errcode = 'P0001';
  end if;

  select * into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = schedule_row.agreement_id
    and listing_request_agreements.listing_request_id = stripe_payment_row.listing_request_id
    and listing_request_agreements.buyer_user_id = stripe_payment_row.payer_user_id
    and listing_request_agreements.creator_user_id = stripe_payment_row.creator_user_id
    and listing_request_agreements.status = 'buyer_accepted'
  for update;

  if not found then
    raise exception 'The accepted project agreement for this Stripe payment could not be found.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.listing_request_change_orders
    where listing_request_change_orders.id = schedule_row.change_order_id
      and listing_request_change_orders.agreement_id = agreement_row.id
      and listing_request_change_orders.status = 'buyer_accepted'
      and listing_request_change_orders.applied_at is not null
  ) then
    raise exception 'The accepted change order could not be found.'
      using errcode = 'P0001';
  end if;

  if schedule_row.status <> 'paid' then
    if schedule_row.status <> 'payment_required' then
      raise exception 'This change-order payment is not awaiting confirmation.'
        using errcode = 'P0001';
    end if;

    update public.listing_request_payment_schedule_items
    set status = 'paid', paid_at = coalesce(paid_at, payment_confirmed_at)
    where listing_request_payment_schedule_items.id = schedule_row.id;

    did_apply_workflow := true;

    select count(*) into remaining_payment_count
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.agreement_id = agreement_row.id
      and listing_request_payment_schedule_items.payment_timing = 'due_on_change_order_acceptance'
      and listing_request_payment_schedule_items.status in ('pending', 'payment_required');

    if remaining_payment_count = 0 then
      update public.listing_request_timeline_holds
      set ended_at = payment_confirmed_at
      where listing_request_timeline_holds.listing_request_id = agreement_row.listing_request_id
        and listing_request_timeline_holds.agreement_id = agreement_row.id
        and listing_request_timeline_holds.reason = 'change_order_payment_pending'
        and listing_request_timeline_holds.ended_at is null;

      get diagnostics closed_hold_count = row_count;
      did_close_hold := closed_hold_count > 0;
    end if;

    select conversations.id into conversation_id
    from public.conversations
    where conversations.listing_request_id = agreement_row.listing_request_id
    limit 1;

    if conversation_id is not null then
      insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
      values (
        conversation_id,
        stripe_payment_row.payer_user_id,
        'system',
        format('Stripe confirmed the required change-order payment: %s.', schedule_row.title)
      );
    end if;
  end if;

  return query
  select
    stripe_payment_row.id,
    schedule_row.id,
    schedule_row.change_order_id,
    agreement_row.id,
    agreement_row.listing_request_id,
    did_apply_workflow,
    did_close_hold,
    payment_confirmed_at;
end;
$$;

revoke all on function public.apply_paid_listing_request_change_order_payment(uuid) from public;
revoke all on function public.apply_paid_listing_request_change_order_payment(uuid) from anon;
revoke all on function public.apply_paid_listing_request_change_order_payment(uuid) from authenticated;
grant execute on function public.apply_paid_listing_request_change_order_payment(uuid) to service_role;


create or replace function
public.apply_paid_listing_request_final_balance_payment(
  p_listing_request_payment_id uuid
)
returns table (
  listing_request_payment_id uuid,
  payment_schedule_item_id uuid,
  final_delivery_id uuid,
  agreement_id uuid,
  listing_request_id uuid,
  workflow_applied boolean,
  hold_closed boolean,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  stripe_payment_row public.listing_request_payments%rowtype;
  schedule_row public.listing_request_payment_schedule_items%rowtype;
  agreement_row public.listing_request_agreements%rowtype;
  final_delivery_row public.listing_request_final_deliveries%rowtype;

  payment_confirmed_at timestamptz;
  conversation_id uuid;
  remaining_payment_count integer := 0;
  closed_hold_count integer := 0;
  did_apply_workflow boolean := false;
  did_close_hold boolean := false;
begin
  select * into stripe_payment_row
  from public.listing_request_payments
  where listing_request_payments.id = p_listing_request_payment_id
  for update;

  if not found then
    raise exception 'Stripe payment % was not found.', p_listing_request_payment_id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.status <> 'paid' then
    raise exception 'Stripe payment % has not been confirmed as paid.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_type <> 'final_balance' then
    raise exception 'Stripe payment % is not a final-balance payment.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  if stripe_payment_row.payment_schedule_item_id is null then
    raise exception 'Stripe final-balance payment % is missing its payment schedule item.', stripe_payment_row.id
      using errcode = 'P0001';
  end if;

  payment_confirmed_at := coalesce(stripe_payment_row.paid_at, now());

  select * into schedule_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id = stripe_payment_row.payment_schedule_item_id
    and listing_request_payment_schedule_items.payment_timing = 'due_before_final_release'
    and listing_request_payment_schedule_items.amount > 0
  for update;

  if not found then
    raise exception 'The final-balance schedule item could not be found.'
      using errcode = 'P0001';
  end if;

  select * into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = schedule_row.agreement_id
    and listing_request_agreements.listing_request_id = stripe_payment_row.listing_request_id
    and listing_request_agreements.buyer_user_id = stripe_payment_row.payer_user_id
    and listing_request_agreements.creator_user_id = stripe_payment_row.creator_user_id
    and listing_request_agreements.status = 'buyer_accepted'
  for update;

  if not found then
    raise exception 'The accepted project agreement for this Stripe payment could not be found.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  select * into final_delivery_row
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.agreement_id = agreement_row.id
    and listing_request_final_deliveries.listing_request_id = agreement_row.listing_request_id
    and listing_request_final_deliveries.status = 'submitted'
    and listing_request_final_deliveries.submitted_at is not null
  order by listing_request_final_deliveries.version_number desc
  limit 1
  for update;

  if not found then
    raise exception 'A submitted final delivery could not be found for this payment.'
      using errcode = 'P0001';
  end if;

  if schedule_row.status <> 'paid' then
    if schedule_row.status <> 'payment_required' then
      raise exception 'This final-balance payment is not awaiting confirmation.'
        using errcode = 'P0001';
    end if;

    update public.listing_request_payment_schedule_items
    set status = 'paid', paid_at = coalesce(paid_at, payment_confirmed_at)
    where listing_request_payment_schedule_items.id = schedule_row.id;

    did_apply_workflow := true;

    select count(*) into remaining_payment_count
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.agreement_id = agreement_row.id
      and listing_request_payment_schedule_items.payment_timing = 'due_before_final_release'
      and listing_request_payment_schedule_items.status in ('pending', 'payment_required')
      and listing_request_payment_schedule_items.amount > 0;

    if remaining_payment_count = 0 then
      update public.listing_request_timeline_holds
      set ended_at = payment_confirmed_at
      where listing_request_timeline_holds.listing_request_id = agreement_row.listing_request_id
        and listing_request_timeline_holds.agreement_id = agreement_row.id
        and listing_request_timeline_holds.reason = 'balance_payment_pending'
        and listing_request_timeline_holds.ended_at is null;

      get diagnostics closed_hold_count = row_count;
      did_close_hold := closed_hold_count > 0;
    end if;

    select conversations.id into conversation_id
    from public.conversations
    where conversations.listing_request_id = agreement_row.listing_request_id
    limit 1;

    if conversation_id is not null then
      insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
      values (
        conversation_id,
        stripe_payment_row.payer_user_id,
        'system',
        format('Stripe confirmed the required final-balance payment: %s.', schedule_row.title)
      );
    end if;
  end if;

  return query
  select
    stripe_payment_row.id,
    schedule_row.id,
    final_delivery_row.id,
    agreement_row.id,
    agreement_row.listing_request_id,
    did_apply_workflow,
    did_close_hold,
    payment_confirmed_at;
end;
$$;

revoke all on function public.apply_paid_listing_request_final_balance_payment(uuid) from public;
revoke all on function public.apply_paid_listing_request_final_balance_payment(uuid) from anon;
revoke all on function public.apply_paid_listing_request_final_balance_payment(uuid) from authenticated;
grant execute on function public.apply_paid_listing_request_final_balance_payment(uuid) to service_role;
