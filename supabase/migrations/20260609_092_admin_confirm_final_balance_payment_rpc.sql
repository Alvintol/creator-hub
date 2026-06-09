drop function if exists
public.admin_confirm_listing_request_final_balance_payment(uuid);

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
        'The required final-balance payment was confirmed: %s.',
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

grant execute on function
public.admin_confirm_listing_request_final_balance_payment(uuid)
to authenticated;