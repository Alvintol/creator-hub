create or replace function public.create_listing_request_agreement(
  p_listing_request_id uuid,
  p_status text,
  p_payment_structure text,
  p_starting_payment_status text,
  p_currency text,
  p_base_amount numeric,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_estimated_start_at timestamptz,
  p_estimated_completion_at timestamptz,
  p_late_delivery_grace_days integer,
  p_included_revision_count integer,
  p_minimum_update_rule text,
  p_first_update_due_days integer,
  p_update_frequency_days integer,
  p_scope_summary text,
  p_included_deliverables text[],
  p_additional_cost_policy text,
  p_revision_policy text,
  p_update_schedule_summary text,
  p_items jsonb default '[]'::jsonb,
  p_payment_schedule_items jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  status text,
  version_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_requests%rowtype;
  new_agreement_id uuid;
  next_version_number integer;
  safe_items jsonb;
  safe_payment_schedule_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a project agreement.'
      using errcode = '42501';
  end if;

  if p_status not in ('draft', 'sent') then
    raise exception 'Agreement status must be draft or sent.'
      using errcode = 'P0001';
  end if;

  safe_items := coalesce(p_items, '[]'::jsonb);
  safe_payment_schedule_items := coalesce(p_payment_schedule_items, '[]'::jsonb);

  if jsonb_typeof(safe_items) <> 'array' then
    raise exception 'Agreement items must be provided as an array.'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(safe_payment_schedule_items) <> 'array' then
    raise exception 'Payment schedule items must be provided as an array.'
      using errcode = 'P0001';
  end if;

  select *
  into request_row
  from public.listing_requests
  where listing_requests.id = p_listing_request_id
    and listing_requests.creator_user_id = auth.uid()
    and listing_requests.status = 'accepted'
  limit 1;

  if not found then
    raise exception 'This request is not available for a project agreement.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.listing_request_id = p_listing_request_id
      and listing_request_agreements.status in (
        'draft',
        'sent',
        'buyer_accepted'
      )
  ) then
    raise exception 'This request already has an active project agreement.'
      using errcode = 'P0001';
  end if;

  select coalesce(max(listing_request_agreements.version_number), 0) + 1
  into next_version_number
  from public.listing_request_agreements
  where listing_request_agreements.listing_request_id = p_listing_request_id;

  insert into public.listing_request_agreements (
    listing_request_id,
    creator_user_id,
    buyer_user_id,
    version_number,
    status,
    payment_structure,
    starting_payment_status,
    currency,
    base_amount,
    total_amount,
    deposit_amount,
    estimated_start_at,
    estimated_completion_at,
    adjusted_estimated_completion_at,
    late_delivery_grace_days,
    included_revision_count,
    minimum_update_rule,
    first_update_due_days,
    update_frequency_days,
    scope_summary,
    included_deliverables,
    additional_cost_policy,
    revision_policy,
    update_schedule_summary,
    sent_at
  )
  values (
    p_listing_request_id,
    request_row.creator_user_id,
    request_row.buyer_user_id,
    next_version_number,
    p_status,
    p_payment_structure,
    p_starting_payment_status,
    lower(p_currency),
    p_base_amount,
    p_total_amount,
    p_deposit_amount,
    p_estimated_start_at,
    p_estimated_completion_at,
    p_estimated_completion_at,
    p_late_delivery_grace_days,
    p_included_revision_count,
    p_minimum_update_rule,
    p_first_update_due_days,
    p_update_frequency_days,
    p_scope_summary,
    coalesce(p_included_deliverables, '{}'::text[]),
    p_additional_cost_policy,
    p_revision_policy,
    p_update_schedule_summary,
    case when p_status = 'sent' then now() else null end
  )
  returning listing_request_agreements.id
  into new_agreement_id;

  insert into public.listing_request_agreement_items (
    agreement_id,
    title,
    description,
    item_type,
    price_amount,
    timeline_impact_days,
    payment_timing,
    is_required,
    is_selected,
    sort_order
  )
  select
    new_agreement_id,
    item.value ->> 'title',
    nullif(item.value ->> 'description', ''),
    item.value ->> 'item_type',
    nullif(item.value ->> 'price_amount', '')::numeric,
    nullif(item.value ->> 'timeline_impact_days', '')::integer,
    item.value ->> 'payment_timing',
    coalesce((item.value ->> 'is_required')::boolean, true),
    coalesce((item.value ->> 'is_selected')::boolean, true),
    coalesce((item.value ->> 'sort_order')::integer, item.ordinality::integer - 1)
  from jsonb_array_elements(safe_items) with ordinality as item(value, ordinality);

  insert into public.listing_request_payment_schedule_items (
    agreement_id,
    title,
    description,
    amount,
    currency,
    payment_timing,
    status,
    due_at,
    sort_order
  )
  select
    new_agreement_id,
    payment_item.value ->> 'title',
    nullif(payment_item.value ->> 'description', ''),
    (payment_item.value ->> 'amount')::numeric,
    lower(coalesce(payment_item.value ->> 'currency', p_currency)),
    payment_item.value ->> 'payment_timing',
    coalesce(payment_item.value ->> 'status', 'pending'),
    nullif(payment_item.value ->> 'due_at', '')::timestamptz,
    coalesce(
      (payment_item.value ->> 'sort_order')::integer,
      payment_item.ordinality::integer - 1
    )
  from jsonb_array_elements(safe_payment_schedule_items)
    with ordinality as payment_item(value, ordinality);

  if p_status = 'sent' then
    insert into public.listing_request_timeline_holds (
      listing_request_id,
      agreement_id,
      reason,
      started_at
    )
    values (
      p_listing_request_id,
      new_agreement_id,
      'agreement_acceptance_pending',
      now()
    )
    on conflict do nothing;
  end if;

  return query
  select
    listing_request_agreements.id,
    listing_request_agreements.status,
    listing_request_agreements.version_number
  from public.listing_request_agreements
  where listing_request_agreements.id = new_agreement_id;
end;
$$;

grant execute on function public.create_listing_request_agreement(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  timestamptz,
  timestamptz,
  integer,
  integer,
  text,
  integer,
  integer,
  text,
  text[],
  text,
  text,
  text,
  jsonb,
  jsonb
) to authenticated;