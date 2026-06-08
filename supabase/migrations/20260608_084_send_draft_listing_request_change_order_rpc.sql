drop function if exists public.send_draft_listing_request_change_order(uuid);

create or replace function public.send_draft_listing_request_change_order(
  p_change_order_id uuid
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  version_number integer,
  sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  change_order_row public.listing_request_change_orders%rowtype;
  change_order_sent_at timestamptz := now();
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send a change order.'
      using errcode = '42501';
  end if;

  select *
  into change_order_row
  from public.listing_request_change_orders
  where listing_request_change_orders.id = p_change_order_id
    and listing_request_change_orders.creator_user_id = auth.uid()
    and listing_request_change_orders.status = 'draft'
  for update;

  if not found then
    raise exception 'This draft change order is not available to send.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_request_agreements
    inner join public.listing_requests
      on listing_requests.id =
        listing_request_agreements.listing_request_id
    where listing_request_agreements.id =
      change_order_row.agreement_id
      and listing_request_agreements.listing_request_id =
        change_order_row.listing_request_id
      and listing_request_agreements.creator_user_id =
        auth.uid()
      and listing_request_agreements.status =
        'buyer_accepted'
      and listing_requests.creator_user_id =
        auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not ready for a change order.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_change_orders
  set
    status = 'sent',
    sent_at = coalesce(
      listing_request_change_orders.sent_at,
      change_order_sent_at
    )
  where listing_request_change_orders.id =
    change_order_row.id;

  insert into public.listing_request_timeline_holds (
    listing_request_id,
    agreement_id,
    reason,
    started_at
  )
  values (
    change_order_row.listing_request_id,
    change_order_row.agreement_id,
    'change_order_response_pending',
    change_order_sent_at
  )
  on conflict do nothing;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id =
    change_order_row.listing_request_id
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
        'The creator sent a project change order for buyer review: %s',
        change_order_row.title
      )
    );
  end if;

  return query
  select
    listing_request_change_orders.id,
    listing_request_change_orders.listing_request_id,
    listing_request_change_orders.agreement_id,
    listing_request_change_orders.status,
    listing_request_change_orders.version_number,
    listing_request_change_orders.sent_at
  from public.listing_request_change_orders
  where listing_request_change_orders.id =
    change_order_row.id;
end;
$$;

grant execute on function public.send_draft_listing_request_change_order(uuid)
to authenticated;