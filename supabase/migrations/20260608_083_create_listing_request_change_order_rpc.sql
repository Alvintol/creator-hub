drop function if exists public.create_listing_request_change_order(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  numeric,
  timestamptz,
  jsonb
);

create or replace function public.create_listing_request_change_order(
  p_agreement_id uuid,
  p_status text,
  p_title text,
  p_summary text,
  p_changes_scope boolean,
  p_changes_price boolean,
  p_changes_timeline boolean,
  p_changes_deliverables boolean,
  p_changes_payment_schedule boolean,
  p_changes_milestones boolean,
  p_revised_total_amount numeric default null,
  p_revised_completion_at timestamptz default null,
  p_proposed_snapshot jsonb default '{}'::jsonb
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
  agreement_row public.listing_request_agreements%rowtype;
  request_row public.listing_requests%rowtype;

  clean_title text := btrim(coalesce(p_title, ''));
  clean_summary text := btrim(coalesce(p_summary, ''));

  next_version_number integer;
  new_change_order_id uuid;
  change_order_sent_at timestamptz;

  calculated_price_delta numeric(12, 2) := 0;
  calculated_timeline_delta_days integer := 0;

  before_snapshot_value jsonb;
  proposed_snapshot_value jsonb;

  agreement_items_snapshot jsonb;
  payment_schedule_snapshot jsonb;

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a change order.'
      using errcode = '42501';
  end if;

  if p_status not in ('draft', 'sent') then
    raise exception 'Change order status must be draft or sent.'
      using errcode = '22023';
  end if;

  if char_length(clean_title) < 3
    or char_length(clean_title) > 160 then
    raise exception 'Change order title must be between 3 and 160 characters.'
      using errcode = '22023';
  end if;

  if char_length(clean_summary) < 10
    or char_length(clean_summary) > 4000 then
    raise exception 'Change order summary must be between 10 and 4000 characters.'
      using errcode = '22023';
  end if;

  if not (
    coalesce(p_changes_scope, false)
    or coalesce(p_changes_price, false)
    or coalesce(p_changes_timeline, false)
    or coalesce(p_changes_deliverables, false)
    or coalesce(p_changes_payment_schedule, false)
    or coalesce(p_changes_milestones, false)
  ) then
    raise exception 'A change order must change at least one project term.'
      using errcode = '22023';
  end if;

  if p_changes_price
    and p_revised_total_amount is null then
    raise exception 'A revised total amount is required for a price change.'
      using errcode = '22023';
  end if;

  if p_changes_price
    and p_revised_total_amount < 0 then
    raise exception 'The revised total amount cannot be negative.'
      using errcode = '22023';
  end if;

  if p_changes_timeline
    and p_revised_completion_at is null then
    raise exception 'A revised completion date is required for a timeline change.'
      using errcode = '22023';
  end if;

  if p_proposed_snapshot is null
    or jsonb_typeof(p_proposed_snapshot) <> 'object' then
    raise exception 'The proposed change snapshot must be an object.'
      using errcode = '22023';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id
    and listing_request_agreements.creator_user_id = auth.uid()
    and listing_request_agreements.status = 'buyer_accepted'
  for update;

  if not found then
    raise exception 'This accepted agreement is not available for a change order.'
      using errcode = 'P0001';
  end if;

  select *
  into request_row
  from public.listing_requests
  where listing_requests.id = agreement_row.listing_request_id
    and listing_requests.creator_user_id = auth.uid()
    and listing_requests.status = 'accepted';

  if not found then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_change_orders
    where listing_request_change_orders.agreement_id =
      agreement_row.id
      and listing_request_change_orders.status in (
        'draft',
        'sent'
      )
  ) then
    raise exception 'This agreement already has a pending change order.'
      using errcode = 'P0001';
  end if;

  if p_changes_price then
    calculated_price_delta :=
      p_revised_total_amount - agreement_row.total_amount;
  end if;

  if p_changes_timeline then
    calculated_timeline_delta_days :=
      p_revised_completion_at::date
      - agreement_row.adjusted_estimated_completion_at::date;

    if calculated_timeline_delta_days < -365
      or calculated_timeline_delta_days > 365 then
      raise exception 'The revised completion date must be within 365 days of the current completion date.'
        using errcode = '22023';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', listing_request_agreement_items.id,
        'title', listing_request_agreement_items.title,
        'description', listing_request_agreement_items.description,
        'item_type', listing_request_agreement_items.item_type,
        'price_amount', listing_request_agreement_items.price_amount,
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
      order by listing_request_agreement_items.sort_order
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
        'id', listing_request_payment_schedule_items.id,
        'title', listing_request_payment_schedule_items.title,
        'description',
          listing_request_payment_schedule_items.description,
        'amount', listing_request_payment_schedule_items.amount,
        'currency', listing_request_payment_schedule_items.currency,
        'payment_timing',
          listing_request_payment_schedule_items.payment_timing,
        'status', listing_request_payment_schedule_items.status,
        'due_at', listing_request_payment_schedule_items.due_at,
        'paid_at', listing_request_payment_schedule_items.paid_at,
        'sort_order',
          listing_request_payment_schedule_items.sort_order
      )
      order by listing_request_payment_schedule_items.sort_order
    ),
    '[]'::jsonb
  )
  into payment_schedule_snapshot
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id =
    agreement_row.id;

  before_snapshot_value := jsonb_build_object(
    'agreement_id', agreement_row.id,
    'agreement_version_number', agreement_row.version_number,
    'payment_structure', agreement_row.payment_structure,
    'starting_payment_status',
      agreement_row.starting_payment_status,
    'currency', agreement_row.currency,
    'base_amount', agreement_row.base_amount,
    'total_amount', agreement_row.total_amount,
    'deposit_amount', agreement_row.deposit_amount,
    'estimated_start_at', agreement_row.estimated_start_at,
    'estimated_completion_at',
      agreement_row.estimated_completion_at,
    'adjusted_estimated_completion_at',
      agreement_row.adjusted_estimated_completion_at,
    'late_delivery_grace_days',
      agreement_row.late_delivery_grace_days,
    'included_revision_count',
      agreement_row.included_revision_count,
    'minimum_update_rule',
      agreement_row.minimum_update_rule,
    'first_update_due_days',
      agreement_row.first_update_due_days,
    'update_frequency_days',
      agreement_row.update_frequency_days,
    'scope_summary', agreement_row.scope_summary,
    'included_deliverables',
      to_jsonb(agreement_row.included_deliverables),
    'additional_cost_policy',
      agreement_row.additional_cost_policy,
    'revision_policy', agreement_row.revision_policy,
    'update_schedule_summary',
      agreement_row.update_schedule_summary,
    'agreement_items', agreement_items_snapshot,
    'payment_schedule_items', payment_schedule_snapshot
  );

  proposed_snapshot_value :=
    p_proposed_snapshot
    || jsonb_strip_nulls(
      jsonb_build_object(
        'agreement_id', agreement_row.id,
        'agreement_version_number',
          agreement_row.version_number,
        'currency', agreement_row.currency,
        'revised_total_amount',
          case
            when p_changes_price
              then p_revised_total_amount
            else null
          end,
        'price_delta', calculated_price_delta,
        'revised_completion_at',
          case
            when p_changes_timeline
              then p_revised_completion_at
            else null
          end,
        'timeline_delta_days',
          calculated_timeline_delta_days,
        'impacts',
          jsonb_build_object(
            'scope', coalesce(p_changes_scope, false),
            'price', coalesce(p_changes_price, false),
            'timeline', coalesce(p_changes_timeline, false),
            'deliverables',
              coalesce(p_changes_deliverables, false),
            'payment_schedule',
              coalesce(p_changes_payment_schedule, false),
            'milestones',
              coalesce(p_changes_milestones, false)
          )
      )
    );

  select coalesce(
    max(listing_request_change_orders.version_number),
    0
  ) + 1
  into next_version_number
  from public.listing_request_change_orders
  where listing_request_change_orders.agreement_id =
    agreement_row.id;

  change_order_sent_at :=
    case
      when p_status = 'sent' then now()
      else null
    end;

  insert into public.listing_request_change_orders (
    listing_request_id,
    agreement_id,
    creator_user_id,
    buyer_user_id,
    version_number,
    status,
    title,
    summary,
    changes_scope,
    changes_price,
    changes_timeline,
    changes_deliverables,
    changes_payment_schedule,
    changes_milestones,
    price_delta,
    revised_total_amount,
    timeline_delta_days,
    revised_completion_at,
    before_snapshot,
    proposed_snapshot,
    sent_at
  )
  values (
    agreement_row.listing_request_id,
    agreement_row.id,
    agreement_row.creator_user_id,
    agreement_row.buyer_user_id,
    next_version_number,
    p_status,
    clean_title,
    clean_summary,
    coalesce(p_changes_scope, false),
    coalesce(p_changes_price, false),
    coalesce(p_changes_timeline, false),
    coalesce(p_changes_deliverables, false),
    coalesce(p_changes_payment_schedule, false),
    coalesce(p_changes_milestones, false),
    calculated_price_delta,
    case
      when p_changes_price
        then p_revised_total_amount
      else null
    end,
    calculated_timeline_delta_days,
    case
      when p_changes_timeline
        then p_revised_completion_at
      else null
    end,
    before_snapshot_value,
    proposed_snapshot_value,
    change_order_sent_at
  )
  returning listing_request_change_orders.id
  into new_change_order_id;

  if p_status = 'sent' then
    insert into public.listing_request_timeline_holds (
      listing_request_id,
      agreement_id,
      reason,
      started_at
    )
    values (
      agreement_row.listing_request_id,
      agreement_row.id,
      'change_order_response_pending',
      change_order_sent_at
    )
    on conflict do nothing;

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
          'The creator sent a project change order for buyer review: %s',
          clean_title
        )
      );
    end if;
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
    new_change_order_id;
end;
$$;

grant execute on function public.create_listing_request_change_order(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  numeric,
  timestamptz,
  jsonb
)
to authenticated;