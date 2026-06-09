drop function if exists
public.respond_listing_request_final_delivery(
  uuid,
  text,
  text
);

create or replace function
public.respond_listing_request_final_delivery(
  p_final_delivery_id uuid,
  p_response text,
  p_revision_request_reason text default null
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  revision_request_reason text,
  revision_requested_at timestamptz,
  buyer_approved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  final_delivery_row
    public.listing_request_final_deliveries%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  response_at timestamptz := now();

  clean_revision_request_reason text :=
    nullif(
      btrim(
        coalesce(
          p_revision_request_reason,
          ''
        )
      ),
      ''
    );

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to respond to a final delivery.'
      using errcode = '42501';
  end if;

  if p_response not in (
    'revision_requested',
    'buyer_approved'
  ) then
    raise exception
      'Final delivery response must be revision_requested or buyer_approved.'
      using errcode = '22023';
  end if;

  if p_response = 'revision_requested'
    and (
      clean_revision_request_reason is null
      or char_length(
        clean_revision_request_reason
      ) < 10
    ) then
    raise exception
      'A revision request reason of at least 10 characters is required.'
      using errcode = '22023';
  end if;

  if clean_revision_request_reason is not null
    and char_length(
      clean_revision_request_reason
    ) > 2000 then
    raise exception
      'Revision request reason cannot exceed 2000 characters.'
      using errcode = '22023';
  end if;

  select *
  into final_delivery_row
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.id =
      p_final_delivery_id
    and listing_request_final_deliveries.buyer_user_id =
      auth.uid()
    and listing_request_final_deliveries.status =
      'submitted'
    and listing_request_final_deliveries.submitted_at
      is not null
  for update;

  if not found then
    raise exception
      'This final delivery is not available for your response.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      final_delivery_row.agreement_id
    and listing_request_agreements.listing_request_id =
      final_delivery_row.listing_request_id
    and listing_request_agreements.buyer_user_id =
      auth.uid()
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
        final_delivery_row.listing_request_id
      and listing_requests.buyer_user_id =
        auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  if p_response = 'buyer_approved' then
    if exists (
      select 1
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id =
          agreement_row.id
        and listing_request_payment_schedule_items.payment_timing =
          'due_before_final_release'
        and listing_request_payment_schedule_items.status in (
          'pending',
          'payment_required'
        )
        and listing_request_payment_schedule_items.amount > 0
    ) then
      raise exception
        'The final balance must be paid before the delivery can be approved.'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.listing_request_timeline_holds
      where listing_request_timeline_holds.agreement_id =
          agreement_row.id
        and listing_request_timeline_holds.reason =
          'balance_payment_pending'
        and listing_request_timeline_holds.ended_at
          is null
    ) then
      raise exception
        'The final balance payment is still awaiting confirmation.'
        using errcode = 'P0001';
    end if;

    update public.listing_request_final_deliveries
    set
      status = 'buyer_approved',
      buyer_approved_at = response_at,
      revision_requested_at = null,
      revision_request_reason = null
    where listing_request_final_deliveries.id =
      final_delivery_row.id;
  else
    update public.listing_request_final_deliveries
    set
      status = 'revision_requested',
      revision_requested_at = response_at,
      buyer_approved_at = null,
      revision_request_reason =
        clean_revision_request_reason
    where listing_request_final_deliveries.id =
      final_delivery_row.id;

    update public.listing_request_payment_schedule_items
    set
      status = 'pending',
      due_at = null
    where listing_request_payment_schedule_items.agreement_id =
        agreement_row.id
      and listing_request_payment_schedule_items.payment_timing =
        'due_before_final_release'
      and listing_request_payment_schedule_items.status =
        'payment_required';

    update public.listing_request_timeline_holds
    set ended_at = response_at
    where listing_request_timeline_holds.listing_request_id =
        final_delivery_row.listing_request_id
      and listing_request_timeline_holds.agreement_id =
        agreement_row.id
      and listing_request_timeline_holds.reason =
        'balance_payment_pending'
      and listing_request_timeline_holds.ended_at
        is null;
  end if;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id =
    final_delivery_row.listing_request_id
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
        when p_response = 'buyer_approved'
          then format(
            'The buyer approved the final project delivery: %s',
            final_delivery_row.title
          )
        else format(
          'The buyer requested revisions to the final project delivery: %s',
          final_delivery_row.title
        )
      end
    );
  end if;

  return query
  select
    listing_request_final_deliveries.id,
    listing_request_final_deliveries.listing_request_id,
    listing_request_final_deliveries.agreement_id,
    listing_request_final_deliveries.status,
    listing_request_final_deliveries.revision_request_reason,
    listing_request_final_deliveries.revision_requested_at,
    listing_request_final_deliveries.buyer_approved_at
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.id =
    final_delivery_row.id;
end;
$$;

grant execute on function
public.respond_listing_request_final_delivery(
  uuid,
  text,
  text
)
to authenticated;