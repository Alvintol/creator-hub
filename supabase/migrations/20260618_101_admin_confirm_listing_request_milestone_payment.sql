drop function if exists
public.admin_confirm_listing_request_milestone_payment(uuid);

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

  if not public.is_admin() then
    raise exception
      'Only admins can confirm milestone payments.'
      using errcode = '42501';
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
        'Admin confirmed payment for milestone %s: %s. The creator can continue with the next milestone.',
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

grant execute on function
public.admin_confirm_listing_request_milestone_payment(uuid)
to authenticated;