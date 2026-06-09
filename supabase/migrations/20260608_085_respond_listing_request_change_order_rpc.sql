drop function if exists public.respond_listing_request_change_order(
  uuid,
  text,
  text
);

create or replace function public.respond_listing_request_change_order(
  p_change_order_id uuid,
  p_response text,
  p_response_reason text default null
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  applied_at timestamptz,
  buyer_response_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  change_order_row public.listing_request_change_orders%rowtype;
  agreement_row public.listing_request_agreements%rowtype;

  response_at timestamptz := now();
  clean_response_reason text :=
    nullif(btrim(coalesce(p_response_reason, '')), '');

  prior_extension_days integer := 0;
  revised_base_completion_at timestamptz;

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to respond to a change order.'
      using errcode = '42501';
  end if;

  if p_response not in (
    'buyer_accepted',
    'buyer_declined'
  ) then
    raise exception 'Change order response must be buyer_accepted or buyer_declined.'
      using errcode = '22023';
  end if;

  if clean_response_reason is not null
    and char_length(clean_response_reason) > 2000 then
    raise exception 'Change order response reason cannot exceed 2000 characters.'
      using errcode = '22023';
  end if;

  select *
  into change_order_row
  from public.listing_request_change_orders
  where listing_request_change_orders.id =
    p_change_order_id
    and listing_request_change_orders.buyer_user_id =
      auth.uid()
    and listing_request_change_orders.status = 'sent'
    and listing_request_change_orders.sent_at is not null
  for update;

  if not found then
    raise exception 'This change order is not available for your response.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
    change_order_row.agreement_id
    and listing_request_agreements.listing_request_id =
      change_order_row.listing_request_id
    and listing_request_agreements.buyer_user_id =
      auth.uid()
    and listing_request_agreements.status =
      'buyer_accepted'
  for update;

  if not found then
    raise exception 'The accepted project agreement could not be found.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
      change_order_row.listing_request_id
      and listing_requests.buyer_user_id =
        auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  if p_response = 'buyer_accepted' then
    if change_order_row.changes_price
      and change_order_row.revised_total_amount is null then
      raise exception 'This price change does not include a revised total.'
        using errcode = 'P0001';
    end if;

    if change_order_row.changes_timeline
      and change_order_row.revised_completion_at is null then
      raise exception 'This timeline change does not include a revised completion date.'
        using errcode = 'P0001';
    end if;

    if change_order_row.changes_timeline then
      select coalesce(
        sum(
          listing_request_timeline_holds.rounded_extension_days
        ),
        0
      )
      into prior_extension_days
      from public.listing_request_timeline_holds
      where listing_request_timeline_holds.agreement_id =
        agreement_row.id
        and listing_request_timeline_holds.ended_at
          is not null;

      revised_base_completion_at :=
        change_order_row.revised_completion_at
        - make_interval(days => prior_extension_days);
    end if;

    update public.listing_request_agreements
    set
      total_amount =
        case
          when change_order_row.changes_price
            then change_order_row.revised_total_amount
          else listing_request_agreements.total_amount
        end,

      estimated_completion_at =
        case
          when change_order_row.changes_timeline
            then revised_base_completion_at
          else listing_request_agreements.estimated_completion_at
        end,

      adjusted_estimated_completion_at =
        case
          when change_order_row.changes_timeline
            then change_order_row.revised_completion_at
          else listing_request_agreements.adjusted_estimated_completion_at
        end

    where listing_request_agreements.id =
      agreement_row.id;

    update public.listing_request_change_orders
    set
      status = 'buyer_accepted',
      buyer_accepted_at = response_at,
      buyer_declined_at = null,
      buyer_response_reason = null,
      applied_at = response_at
    where listing_request_change_orders.id =
      change_order_row.id;

  else
    update public.listing_request_change_orders
    set
      status = 'buyer_declined',
      buyer_accepted_at = null,
      buyer_declined_at = response_at,
      buyer_response_reason = clean_response_reason,
      applied_at = null
    where listing_request_change_orders.id =
      change_order_row.id;
  end if;

  update public.listing_request_timeline_holds
  set ended_at = response_at
  where listing_request_timeline_holds.listing_request_id =
    change_order_row.listing_request_id
    and listing_request_timeline_holds.agreement_id =
      change_order_row.agreement_id
    and listing_request_timeline_holds.reason =
      'change_order_response_pending'
    and listing_request_timeline_holds.ended_at is null;

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
      case
        when p_response = 'buyer_accepted'
          then format(
            'The buyer accepted the project change order: %s',
            change_order_row.title
          )
        else format(
          'The buyer declined the project change order: %s',
          change_order_row.title
        )
      end
    );
  end if;

  return query
  select
    listing_request_change_orders.id,
    listing_request_change_orders.listing_request_id,
    listing_request_change_orders.agreement_id,
    listing_request_change_orders.status,
    listing_request_change_orders.applied_at,
    listing_request_change_orders.buyer_response_reason
  from public.listing_request_change_orders
  where listing_request_change_orders.id =
    change_order_row.id;
end;
$$;

grant execute on function public.respond_listing_request_change_order(
  uuid,
  text,
  text
)
to authenticated;