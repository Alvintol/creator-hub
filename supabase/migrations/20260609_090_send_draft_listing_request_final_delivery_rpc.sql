drop function if exists
public.send_draft_listing_request_final_delivery(uuid);

create or replace function
public.send_draft_listing_request_final_delivery(
  p_final_delivery_id uuid
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  version_number integer,
  submitted_at timestamptz
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

  final_delivery_submitted_at timestamptz := now();

  agreement_items_snapshot jsonb;
  payment_schedule_snapshot jsonb;
  accepted_change_orders_snapshot jsonb;
  agreement_snapshot_value jsonb;

  outstanding_final_payment_count integer := 0;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to submit a final delivery.'
      using errcode = '42501';
  end if;

  select *
  into final_delivery_row
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.id =
      p_final_delivery_id
    and listing_request_final_deliveries.creator_user_id =
      auth.uid()
    and listing_request_final_deliveries.status =
      'draft'
  for update;

  if not found then
    raise exception
      'This final-delivery draft is not available to submit.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      final_delivery_row.agreement_id
    and listing_request_agreements.listing_request_id =
      final_delivery_row.listing_request_id
    and listing_request_agreements.creator_user_id =
      auth.uid()
    and listing_request_agreements.status =
      'buyer_accepted'
  for update;

  if not found then
    raise exception
      'The accepted project agreement could not be found.'
      using errcode = 'P0001';
  end if;

  if agreement_row.starting_payment_status not in (
    'paid',
    'not_required'
  ) then
    raise exception
      'The starting payment must be resolved before final delivery.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
        agreement_row.listing_request_id
      and listing_requests.creator_user_id =
        auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_final_deliveries
    where listing_request_final_deliveries.agreement_id =
        agreement_row.id
      and listing_request_final_deliveries.id <>
        final_delivery_row.id
      and listing_request_final_deliveries.status =
        'submitted'
  ) then
    raise exception
      'This agreement already has a submitted final delivery.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_final_deliveries
    where listing_request_final_deliveries.agreement_id =
        agreement_row.id
      and listing_request_final_deliveries.status =
        'buyer_approved'
  ) then
    raise exception
      'The final delivery for this agreement has already been approved.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_timeline_holds
    where listing_request_timeline_holds.agreement_id =
        agreement_row.id
      and listing_request_timeline_holds.ended_at is null
      and listing_request_timeline_holds.reason <>
        'balance_payment_pending'
  ) then
    raise exception
      'The project has an unresolved hold that must be completed before final delivery.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.agreement_id =
        agreement_row.id
      and listing_request_payment_schedule_items.payment_timing in (
        'due_before_work_starts',
        'due_at_milestone_approval',
        'due_on_change_order_acceptance'
      )
      and listing_request_payment_schedule_items.status in (
        'pending',
        'payment_required'
      )
      and listing_request_payment_schedule_items.amount > 0
  ) then
    raise exception
      'Outstanding project payments must be resolved before final delivery.'
      using errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          listing_request_agreement_items.id,
        'title',
          listing_request_agreement_items.title,
        'description',
          listing_request_agreement_items.description,
        'item_type',
          listing_request_agreement_items.item_type,
        'price_amount',
          listing_request_agreement_items.price_amount,
        'timeline_impact_days',
          listing_request_agreement_items.timeline_impact_days,
        'payment_timing',
          listing_request_agreement_items.payment_timing,
        'is_required',
          listing_request_agreement_items.is_required,
        'is_selected',
          listing_request_agreement_items.is_selected,
        'sort_order',
          listing_request_agreement_items.sort_order
      )
      order by
        listing_request_agreement_items.sort_order
    ),
    '[]'::jsonb
  )
  into agreement_items_snapshot
  from public.listing_request_agreement_items
  where listing_request_agreement_items.agreement_id =
    agreement_row.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          listing_request_payment_schedule_items.id,
        'change_order_id',
          listing_request_payment_schedule_items.change_order_id,
        'title',
          listing_request_payment_schedule_items.title,
        'description',
          listing_request_payment_schedule_items.description,
        'amount',
          listing_request_payment_schedule_items.amount,
        'currency',
          listing_request_payment_schedule_items.currency,
        'payment_timing',
          listing_request_payment_schedule_items.payment_timing,
        'status',
          listing_request_payment_schedule_items.status,
        'due_at',
          listing_request_payment_schedule_items.due_at,
        'paid_at',
          listing_request_payment_schedule_items.paid_at,
        'sort_order',
          listing_request_payment_schedule_items.sort_order
      )
      order by
        listing_request_payment_schedule_items.sort_order
    ),
    '[]'::jsonb
  )
  into payment_schedule_snapshot
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
    agreement_row.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          listing_request_change_orders.id,
        'version_number',
          listing_request_change_orders.version_number,
        'title',
          listing_request_change_orders.title,
        'summary',
          listing_request_change_orders.summary,
        'price_delta',
          listing_request_change_orders.price_delta,
        'revised_total_amount',
          listing_request_change_orders.revised_total_amount,
        'timeline_delta_days',
          listing_request_change_orders.timeline_delta_days,
        'revised_completion_at',
          listing_request_change_orders.revised_completion_at,
        'proposed_snapshot',
          listing_request_change_orders.proposed_snapshot,
        'buyer_accepted_at',
          listing_request_change_orders.buyer_accepted_at,
        'applied_at',
          listing_request_change_orders.applied_at
      )
      order by
        listing_request_change_orders.version_number
    ),
    '[]'::jsonb
  )
  into accepted_change_orders_snapshot
  from public.listing_request_change_orders
  where listing_request_change_orders.agreement_id =
      agreement_row.id
    and listing_request_change_orders.status =
      'buyer_accepted';

  agreement_snapshot_value := jsonb_build_object(
    'agreement_id',
      agreement_row.id,
    'version_number',
      agreement_row.version_number,
    'payment_structure',
      agreement_row.payment_structure,
    'starting_payment_status',
      agreement_row.starting_payment_status,
    'currency',
      agreement_row.currency,
    'base_amount',
      agreement_row.base_amount,
    'total_amount',
      agreement_row.total_amount,
    'deposit_amount',
      agreement_row.deposit_amount,
    'estimated_start_at',
      agreement_row.estimated_start_at,
    'estimated_completion_at',
      agreement_row.estimated_completion_at,
    'adjusted_estimated_completion_at',
      agreement_row.adjusted_estimated_completion_at,
    'included_revision_count',
      agreement_row.included_revision_count,
    'scope_summary',
      agreement_row.scope_summary,
    'included_deliverables',
      to_jsonb(agreement_row.included_deliverables),
    'additional_cost_policy',
      agreement_row.additional_cost_policy,
    'revision_policy',
      agreement_row.revision_policy,
    'update_schedule_summary',
      agreement_row.update_schedule_summary,
    'agreement_items',
      agreement_items_snapshot,
    'payment_schedule_items',
      payment_schedule_snapshot,
    'accepted_change_orders',
      accepted_change_orders_snapshot
  );

  update public.listing_request_final_deliveries
  set
    status = 'submitted',
    submitted_at = coalesce(
      listing_request_final_deliveries.submitted_at,
      final_delivery_submitted_at
    ),
    agreement_snapshot = agreement_snapshot_value
  where listing_request_final_deliveries.id =
    final_delivery_row.id;

  update public.listing_request_payment_schedule_items
  set status = 'waived'
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_final_release'
    and listing_request_payment_schedule_items.status =
      'pending'
    and listing_request_payment_schedule_items.amount = 0;

  update public.listing_request_payment_schedule_items
  set
    status = 'payment_required',
    due_at = coalesce(
      listing_request_payment_schedule_items.due_at,
      final_delivery_submitted_at
    )
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_final_release'
    and listing_request_payment_schedule_items.status =
      'pending'
    and listing_request_payment_schedule_items.amount > 0;

  select count(*)
  into outstanding_final_payment_count
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
      agreement_row.id
    and listing_request_payment_schedule_items.payment_timing =
      'due_before_final_release'
    and listing_request_payment_schedule_items.status =
      'payment_required'
    and listing_request_payment_schedule_items.amount > 0;

  if outstanding_final_payment_count > 0 then
    insert into public.listing_request_timeline_holds (
      listing_request_id,
      agreement_id,
      reason,
      started_at
    )
    values (
      agreement_row.listing_request_id,
      agreement_row.id,
      'balance_payment_pending',
      final_delivery_submitted_at
    )
    on conflict do nothing;
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
        'The creator submitted the final project delivery for buyer review: %s',
        final_delivery_row.title
      )
    );
  end if;

  return query
  select
    listing_request_final_deliveries.id,
    listing_request_final_deliveries.listing_request_id,
    listing_request_final_deliveries.agreement_id,
    listing_request_final_deliveries.status,
    listing_request_final_deliveries.version_number,
    listing_request_final_deliveries.submitted_at
  from public.listing_request_final_deliveries
  where listing_request_final_deliveries.id =
    final_delivery_row.id;
end;
$$;

grant execute on function
public.send_draft_listing_request_final_delivery(uuid)
to authenticated;