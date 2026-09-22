-- Restrict the admin_confirm_*_payment RPCs (launch-scope.md section 11,
-- launch-implementation-checklist.md Sprint 3): "Restrict or remove the
-- admin_confirm_*_payment RPCs... They mark money as received without
-- verifying it moved... it is worse once refunds exist -- a manual
-- confirmation can leave a schedule satisfied against a payment that was
-- refunded."
--
-- Removing them outright would delete a working, tested admin surface
-- (four hooks, four UI action components, AdminRequestDetails wiring) built
-- for a real need -- reconciling a payment that arrived outside the normal
-- Stripe Checkout path. Restricting is the smaller, correct change: close
-- the exact danger the checklist names, and make every use visibly an
-- override rather than something that reads like an ordinary confirmation.
--
-- Two changes to all four functions, logic otherwise unchanged:
--
--   1. Refuse if a listing_request_payments row already exists for the
--      schedule item(s) this would confirm, in any state a real Stripe
--      charge produces (paid, refunded, partially_refunded, disputed).
--      This is the concrete version of "leave a schedule satisfied against
--      a payment that was refunded" -- these RPCs write directly to
--      listing_request_payment_schedule_items / listing_request_agreements
--      and never touch the payments ledger, so without this check nothing
--      stops an admin from manually marking paid a schedule item whose real
--      Stripe payment already came back refunded or disputed.
--   2. The system message posted into the conversation now says the
--      confirmation was manual and bypassed Stripe verification, instead of
--      reading like an ordinary automated confirmation. This is the
--      "labelled as break-glass" half of the checklist's instruction -- the
--      message is the audit trail both parties can see, timestamped and
--      attributed to auth.uid() same as before.
--
-- Also fixes a real pre-existing bug found while testing this migration:
-- admin_confirm_listing_request_milestone_payment (20260618_101) checks
-- "public.is_admin()", a function that has never existed in this database --
-- the real one, defined in 20260429_032, is "public.is_admin_user(p_user_id
-- uuid)". Every call to this RPC has failed with "function public.is_admin()
-- does not exist" (42883) since it was created; confirmed via
-- pg_proc/pg_namespace that no "is_admin" function of any signature exists.
-- Fixed here rather than filed separately since this migration already
-- replaces the same function body.

create or replace function public.admin_confirm_listing_request_starting_payment(
  p_agreement_id uuid
)
returns table (
  agreement_id uuid,
  listing_request_id uuid,
  starting_payment_status text,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
  payment_paid_at timestamptz := now();
  conversation_id uuid;
  updated_payment_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to confirm a starting payment.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  ) then
    raise exception 'Only an administrator can confirm a starting payment.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.listing_request_payment_schedule_items sched
    join public.listing_request_payments pay
      on pay.payment_schedule_item_id = sched.id
    where sched.agreement_id = p_agreement_id
      and sched.payment_timing = 'due_before_work_starts'
      and pay.status in ('paid', 'refunded', 'partially_refunded', 'disputed')
  ) then
    raise exception
      'This starting payment already has a Stripe-verified record (paid, refunded or disputed). Manual confirmation is refused so it cannot override that record.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id
    and listing_request_agreements.status = 'buyer_accepted'
    and listing_request_agreements.starting_payment_status = 'payment_required'
  for update;

  if not found then
    raise exception 'This agreement does not have a starting payment awaiting confirmation.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_payment_schedule_items
  set
    status = 'paid',
    paid_at = coalesce(paid_at, payment_paid_at)
  where listing_request_payment_schedule_items.agreement_id = p_agreement_id
    and listing_request_payment_schedule_items.payment_timing = 'due_before_work_starts'
    and listing_request_payment_schedule_items.status in (
      'pending',
      'payment_required'
    );

  get diagnostics updated_payment_count = row_count;

  if updated_payment_count = 0 then
    raise exception 'No starting payment item is available to confirm.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_agreements
  set starting_payment_status = 'paid'
  where listing_request_agreements.id = p_agreement_id;

  update public.listing_request_timeline_holds
  set ended_at = payment_paid_at
  where listing_request_timeline_holds.agreement_id = p_agreement_id
    and listing_request_timeline_holds.reason = 'starting_payment_pending'
    and listing_request_timeline_holds.ended_at is null;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = agreement_row.listing_request_id
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
      'An administrator manually confirmed the required starting payment, bypassing Stripe verification. Work may now begin.'
    );
  end if;

  return query
  select
    agreement_row.id,
    agreement_row.listing_request_id,
    'paid'::text,
    payment_paid_at;
end;
$$;

revoke all on function public.admin_confirm_listing_request_starting_payment(uuid)
  from public, anon;

grant execute on function public.admin_confirm_listing_request_starting_payment(uuid)
to authenticated;


create or replace function
public.admin_confirm_listing_request_milestone_payment(
  p_payment_schedule_item_id uuid
)
returns table (
  payment_schedule_item_id uuid,
  milestone_id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  payment_status text,
  milestone_status text,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row
    public.listing_request_milestones%rowtype;

  payment_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  confirmation_time timestamptz := now();

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to confirm milestone payments.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(auth.uid()) then
    raise exception
      'Only admins can confirm milestone payments.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.listing_request_payments
    where listing_request_payments.payment_schedule_item_id =
        p_payment_schedule_item_id
      and listing_request_payments.status in (
        'paid', 'refunded', 'partially_refunded', 'disputed'
      )
  ) then
    raise exception
      'This milestone payment already has a Stripe-verified record (paid, refunded or disputed). Manual confirmation is refused so it cannot override that record.'
      using errcode = 'P0001';
  end if;

  select *
  into milestone_row
  from public.listing_request_milestones
  where listing_request_milestones.payment_schedule_item_id =
      p_payment_schedule_item_id
    and listing_request_milestones.status =
      'payment_required'
  for update;

  if not found then
    raise exception
      'This milestone is not awaiting payment confirmation.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      milestone_row.agreement_id
    and listing_request_agreements.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_agreements.status =
      'buyer_accepted'
    and listing_request_agreements.payment_structure =
      'milestone_payments'
  for update;

  if not found then
    raise exception
      'The accepted milestone agreement could not be found.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
        milestone_row.listing_request_id
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  select *
  into payment_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
      p_payment_schedule_item_id
    and listing_request_payment_schedule_items.agreement_id =
      milestone_row.agreement_id
    and listing_request_payment_schedule_items.agreement_item_id =
      milestone_row.agreement_item_id
    and listing_request_payment_schedule_items.payment_timing =
      'due_at_milestone_approval'
    and listing_request_payment_schedule_items.status =
      'payment_required'
  for update;

  if not found then
    raise exception
      'The milestone payment is not awaiting confirmation.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_payment_schedule_items
  set
    status = 'paid',
    paid_at = coalesce(
      listing_request_payment_schedule_items.paid_at,
      confirmation_time
    )
  where listing_request_payment_schedule_items.id =
    payment_row.id;

  update public.listing_request_milestones
  set
    status = 'paid',
    paid_at = confirmation_time
  where listing_request_milestones.id =
    milestone_row.id;

  update public.listing_request_timeline_holds
  set ended_at = confirmation_time
  where listing_request_timeline_holds.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_timeline_holds.agreement_id =
      milestone_row.agreement_id
    and listing_request_timeline_holds.payment_schedule_item_id =
      payment_row.id
    and listing_request_timeline_holds.reason =
      'milestone_payment_pending'
    and listing_request_timeline_holds.ended_at is null;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id =
    milestone_row.listing_request_id
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
        'An administrator manually confirmed payment for milestone %s: %s, bypassing Stripe verification. The creator can continue with the next milestone.',
        milestone_row.sort_order + 1,
        milestone_row.title
      )
    );
  end if;

  return query
  select
    payment_row.id,
    milestone_row.id,
    milestone_row.listing_request_id,
    milestone_row.agreement_id,
    'paid'::text,
    'paid'::text,
    confirmation_time;
end;
$$;

revoke all on function
public.admin_confirm_listing_request_milestone_payment(uuid)
from public, anon;

grant execute on function
public.admin_confirm_listing_request_milestone_payment(uuid)
to authenticated;


create or replace function
public.admin_confirm_listing_request_change_order_payment(
  p_payment_schedule_item_id uuid
)
returns table (
  payment_schedule_item_id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  change_order_id uuid,
  payment_status text,
  paid_at timestamptz,
  hold_closed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  payment_confirmed_at timestamptz := now();
  conversation_id uuid;

  remaining_payment_count integer := 0;
  closed_hold_count integer := 0;
  did_close_hold boolean := false;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to confirm a change-order payment.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  ) then
    raise exception
      'Only an administrator can confirm a change-order payment.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.listing_request_payments
    where listing_request_payments.payment_schedule_item_id =
        p_payment_schedule_item_id
      and listing_request_payments.status in (
        'paid', 'refunded', 'partially_refunded', 'disputed'
      )
  ) then
    raise exception
      'This change-order payment already has a Stripe-verified record (paid, refunded or disputed). Manual confirmation is refused so it cannot override that record.'
      using errcode = 'P0001';
  end if;

  select *
  into payment_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
      p_payment_schedule_item_id
    and listing_request_payment_schedule_items.change_order_id
      is not null
    and listing_request_payment_schedule_items.payment_timing =
      'due_on_change_order_acceptance'
    and listing_request_payment_schedule_items.status =
      'payment_required'
  for update;

  if not found then
    raise exception
      'This change-order payment is not awaiting confirmation.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      payment_row.agreement_id
    and listing_request_agreements.status =
      'buyer_accepted'
  for update;

  if not found then
    raise exception
      'The accepted project agreement could not be found.'
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

  if not exists (
    select 1
    from public.listing_request_change_orders
    where listing_request_change_orders.id =
        payment_row.change_order_id
      and listing_request_change_orders.agreement_id =
        agreement_row.id
      and listing_request_change_orders.status =
        'buyer_accepted'
      and listing_request_change_orders.applied_at
        is not null
  ) then
    raise exception
      'The accepted change order could not be found.'
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
    payment_row.id;

  select count(*)
  into remaining_payment_count
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_on_change_order_acceptance'
    and listing_request_payment_schedule_items.status in (
      'pending',
      'payment_required'
    );

  if remaining_payment_count = 0 then
    update public.listing_request_timeline_holds
    set ended_at = payment_confirmed_at
    where listing_request_timeline_holds.listing_request_id =
        agreement_row.listing_request_id
      and listing_request_timeline_holds.agreement_id =
        agreement_row.id
      and listing_request_timeline_holds.reason =
        'change_order_payment_pending'
      and listing_request_timeline_holds.ended_at
        is null;

    get diagnostics closed_hold_count = row_count;

    did_close_hold := closed_hold_count > 0;
  end if;

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
      auth.uid(),
      'system',
      format(
        'An administrator manually confirmed the required change-order payment: %s, bypassing Stripe verification.',
        payment_row.title
      )
    );
  end if;

  return query
  select
    payment_row.id,
    agreement_row.listing_request_id,
    agreement_row.id,
    payment_row.change_order_id,
    'paid'::text,
    payment_confirmed_at,
    did_close_hold;
end;
$$;

revoke all on function
public.admin_confirm_listing_request_change_order_payment(uuid)
from public, anon;

grant execute on function
public.admin_confirm_listing_request_change_order_payment(uuid)
to authenticated;


create or replace function
public.admin_confirm_listing_request_final_balance_payment(
  p_payment_schedule_item_id uuid
)
returns table (
  payment_schedule_item_id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  final_delivery_id uuid,
  payment_status text,
  paid_at timestamptz,
  hold_closed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row
    public.listing_request_payment_schedule_items%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  final_delivery_row
    public.listing_request_final_deliveries%rowtype;

  payment_confirmed_at timestamptz := now();

  remaining_payment_count integer := 0;
  closed_hold_count integer := 0;
  did_close_hold boolean := false;

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to confirm a final-balance payment.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  ) then
    raise exception
      'Only an administrator can confirm a final-balance payment.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.listing_request_payments
    where listing_request_payments.payment_schedule_item_id =
        p_payment_schedule_item_id
      and listing_request_payments.status in (
        'paid', 'refunded', 'partially_refunded', 'disputed'
      )
  ) then
    raise exception
      'This final-balance payment already has a Stripe-verified record (paid, refunded or disputed). Manual confirmation is refused so it cannot override that record.'
      using errcode = 'P0001';
  end if;

  select *
  into payment_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
      p_payment_schedule_item_id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_final_release'
    and listing_request_payment_schedule_items.status =
      'payment_required'
    and listing_request_payment_schedule_items.amount > 0
  for update;

  if not found then
    raise exception
      'This final-balance payment is not awaiting confirmation.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      payment_row.agreement_id
    and listing_request_agreements.status =
      'buyer_accepted'
  for update;

  if not found then
    raise exception
      'The accepted project agreement could not be found.'
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

  select *
  into final_delivery_row
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.agreement_id =
      agreement_row.id
    and listing_request_final_deliveries.listing_request_id =
      agreement_row.listing_request_id
    and listing_request_final_deliveries.status =
      'submitted'
    and listing_request_final_deliveries.submitted_at
      is not null
  order by
    listing_request_final_deliveries.version_number desc
  limit 1
  for update;

  if not found then
    raise exception
      'A submitted final delivery could not be found for this payment.'
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
    payment_row.id;

  select count(*)
  into remaining_payment_count
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_final_release'
    and listing_request_payment_schedule_items.status in (
      'pending',
      'payment_required'
    )
    and listing_request_payment_schedule_items.amount > 0;

  if remaining_payment_count = 0 then
    update public.listing_request_timeline_holds
    set ended_at = payment_confirmed_at
    where listing_request_timeline_holds.listing_request_id =
        agreement_row.listing_request_id
      and listing_request_timeline_holds.agreement_id =
        agreement_row.id
      and listing_request_timeline_holds.reason =
        'balance_payment_pending'
      and listing_request_timeline_holds.ended_at
        is null;

    get diagnostics closed_hold_count = row_count;

    did_close_hold := closed_hold_count > 0;
  end if;

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
      auth.uid(),
      'system',
      format(
        'An administrator manually confirmed the required final-balance payment: %s, bypassing Stripe verification.',
        payment_row.title
      )
    );
  end if;

  return query
  select
    payment_row.id,
    agreement_row.listing_request_id,
    agreement_row.id,
    final_delivery_row.id,
    'paid'::text,
    payment_confirmed_at,
    did_close_hold;
end;
$$;

revoke all on function
public.admin_confirm_listing_request_final_balance_payment(uuid)
from public, anon;

grant execute on function
public.admin_confirm_listing_request_final_balance_payment(uuid)
to authenticated;
