drop function if exists public.admin_confirm_listing_request_starting_payment(uuid);

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
      'The required starting payment was confirmed. Work may now begin.'
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

grant execute on function public.admin_confirm_listing_request_starting_payment(uuid)
to authenticated;