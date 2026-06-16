alter table public.listing_request_agreement_items
drop constraint if exists
listing_request_agreement_items_id_agreement_unique;

alter table public.listing_request_agreement_items
add constraint
listing_request_agreement_items_id_agreement_unique
unique (id, agreement_id);

alter table public.listing_request_payment_schedule_items
add column if not exists agreement_item_id uuid null;

alter table public.listing_request_payment_schedule_items
drop constraint if exists
listing_request_payment_schedule_items_agreement_item_fkey;

alter table public.listing_request_payment_schedule_items
add constraint
listing_request_payment_schedule_items_agreement_item_fkey
foreign key (
  agreement_item_id,
  agreement_id
)
references public.listing_request_agreement_items (
  id,
  agreement_id
)
on delete cascade;

create unique index if not exists
listing_request_payment_schedule_items_agreement_item_idx
on public.listing_request_payment_schedule_items(
  agreement_item_id
)
where agreement_item_id is not null;

alter table public.listing_request_payment_schedule_items
drop constraint if exists
listing_request_payment_schedule_items_milestone_link_check;

alter table public.listing_request_payment_schedule_items
add constraint
listing_request_payment_schedule_items_milestone_link_check
check (
  payment_timing <> 'due_at_milestone_approval'
  or agreement_item_id is not null
)
not valid;

alter table public.listing_request_payment_schedule_items
drop constraint if exists
listing_request_payment_schedule_items_link_type_check;

alter table public.listing_request_payment_schedule_items
add constraint
listing_request_payment_schedule_items_link_type_check
check (
  agreement_item_id is null
  or (
    payment_timing =
      'due_at_milestone_approval'
    and change_order_id is null
  )
)
not valid;

create or replace function
public.create_listing_request_agreement(
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
  inserted_agreement_item_id uuid;
  linked_agreement_item_id uuid;

  next_version_number integer;

  safe_items jsonb;
  safe_payment_schedule_items jsonb;

  item_record record;
  payment_item_record record;

  item_client_key text;
  payment_item_client_key text;
  linked_agreement_item_id_text text;

  agreement_item_ids_by_key jsonb :=
    '{}'::jsonb;

  milestone_count integer := 0;
  milestone_item_total numeric := 0;
  milestone_payment_total numeric := 0;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to create a project agreement.'
      using errcode = '42501';
  end if;

  if p_status not in ('draft', 'sent') then
    raise exception
      'Agreement status must be draft or sent.'
      using errcode = 'P0001';
  end if;

  safe_items := coalesce(
    p_items,
    '[]'::jsonb
  );

  safe_payment_schedule_items := coalesce(
    p_payment_schedule_items,
    '[]'::jsonb
  );

  if jsonb_typeof(safe_items) <> 'array' then
    raise exception
      'Agreement items must be provided as an array.'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(
    safe_payment_schedule_items
  ) <> 'array' then
    raise exception
      'Payment schedule items must be provided as an array.'
      using errcode = 'P0001';
  end if;

  select *
  into request_row
  from public.listing_requests
  where listing_requests.id =
      p_listing_request_id
    and listing_requests.creator_user_id =
      auth.uid()
    and listing_requests.status = 'accepted'
  limit 1;

  if not found then
    raise exception
      'This request is not available for a project agreement.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.listing_request_id =
        p_listing_request_id
      and listing_request_agreements.status in (
        'draft',
        'sent',
        'buyer_accepted'
      )
  ) then
    raise exception
      'This request already has an active project agreement.'
      using errcode = 'P0001';
  end if;

  select coalesce(
    max(
      listing_request_agreements.version_number
    ),
    0
  ) + 1
  into next_version_number
  from public.listing_request_agreements
  where listing_request_agreements.listing_request_id =
    p_listing_request_id;

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
    coalesce(
      p_included_deliverables,
      '{}'::text[]
    ),
    p_additional_cost_policy,
    p_revision_policy,
    p_update_schedule_summary,
    case
      when p_status = 'sent'
        then now()
      else null
    end
  )
  returning listing_request_agreements.id
  into new_agreement_id;

  for item_record in
    select
      agreement_item.value,
      agreement_item.ordinality
    from jsonb_array_elements(
      safe_items
    ) with ordinality
      as agreement_item(value, ordinality)
  loop
    item_client_key :=
      nullif(
        btrim(
          coalesce(
            item_record.value ->> 'client_key',
            ''
          )
        ),
        ''
      );

    if item_client_key is not null
      and item_record.value ->> 'item_type'
        <> 'milestone' then
      raise exception
        'Only milestone items can have payment correlation keys.'
        using errcode = 'P0001';
    end if;

    if item_client_key is not null
      and agreement_item_ids_by_key
        ? item_client_key then
      raise exception
        'Milestone item correlation keys must be unique.'
        using errcode = 'P0001';
    end if;

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
    values (
      new_agreement_id,
      item_record.value ->> 'title',
      nullif(
        item_record.value ->> 'description',
        ''
      ),
      item_record.value ->> 'item_type',
      nullif(
        item_record.value ->> 'price_amount',
        ''
      )::numeric,
      nullif(
        item_record.value
          ->> 'timeline_impact_days',
        ''
      )::integer,
      item_record.value ->> 'payment_timing',
      coalesce(
        (
          item_record.value
            ->> 'is_required'
        )::boolean,
        true
      ),
      coalesce(
        (
          item_record.value
            ->> 'is_selected'
        )::boolean,
        true
      ),
      coalesce(
        (
          item_record.value
            ->> 'sort_order'
        )::integer,
        item_record.ordinality::integer - 1
      )
    )
    returning
      listing_request_agreement_items.id
    into inserted_agreement_item_id;

    if item_client_key is not null then
      agreement_item_ids_by_key :=
        agreement_item_ids_by_key
        || jsonb_build_object(
          item_client_key,
          inserted_agreement_item_id::text
        );
    end if;
  end loop;

  for payment_item_record in
    select
      payment_item.value,
      payment_item.ordinality
    from jsonb_array_elements(
      safe_payment_schedule_items
    ) with ordinality
      as payment_item(value, ordinality)
  loop
    payment_item_client_key :=
      nullif(
        btrim(
          coalesce(
            payment_item_record.value
              ->> 'agreement_item_client_key',
            ''
          )
        ),
        ''
      );

    linked_agreement_item_id := null;

    if payment_item_client_key is not null then
      linked_agreement_item_id_text :=
        agreement_item_ids_by_key
          ->> payment_item_client_key;

      if linked_agreement_item_id_text
        is null then
        raise exception
          'A milestone payment references an unknown agreement item.'
          using errcode = 'P0001';
      end if;

      linked_agreement_item_id :=
        linked_agreement_item_id_text::uuid;
    end if;

    if payment_item_record.value
        ->> 'payment_timing'
        = 'due_at_milestone_approval'
      and linked_agreement_item_id is null then
      raise exception
        'Every milestone payment must reference its milestone agreement item.'
        using errcode = 'P0001';
    end if;

    if linked_agreement_item_id is not null
      and payment_item_record.value
        ->> 'payment_timing'
        <> 'due_at_milestone_approval' then
      raise exception
        'Only milestone payments can reference milestone agreement items.'
        using errcode = 'P0001';
    end if;

    insert into public.listing_request_payment_schedule_items (
      agreement_id,
      agreement_item_id,
      title,
      description,
      amount,
      currency,
      payment_timing,
      status,
      due_at,
      sort_order
    )
    values (
      new_agreement_id,
      linked_agreement_item_id,
      payment_item_record.value ->> 'title',
      nullif(
        payment_item_record.value
          ->> 'description',
        ''
      ),
      (
        payment_item_record.value
          ->> 'amount'
      )::numeric,
      lower(
        coalesce(
          payment_item_record.value
            ->> 'currency',
          p_currency
        )
      ),
      payment_item_record.value
        ->> 'payment_timing',
      coalesce(
        payment_item_record.value
          ->> 'status',
        'pending'
      ),
      nullif(
        payment_item_record.value
          ->> 'due_at',
        ''
      )::timestamptz,
      coalesce(
        (
          payment_item_record.value
            ->> 'sort_order'
        )::integer,
        payment_item_record.ordinality::integer - 1
      )
    );
  end loop;

  if p_payment_structure =
    'milestone_payments' then
    select
      count(*),
      coalesce(sum(price_amount), 0)
    into
      milestone_count,
      milestone_item_total
    from public.listing_request_agreement_items
    where listing_request_agreement_items.agreement_id =
        new_agreement_id
      and listing_request_agreement_items.item_type =
        'milestone';

    if milestone_count < 2 then
      raise exception
        'Milestone payment agreements require at least two milestones.'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.listing_request_agreement_items
      where listing_request_agreement_items.agreement_id =
          new_agreement_id
        and listing_request_agreement_items.item_type =
          'milestone'
        and (
          listing_request_agreement_items.price_amount
            is null
          or listing_request_agreement_items.price_amount
            <= 0
        )
    ) then
      raise exception
        'Every milestone must have an amount greater than zero.'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.listing_request_agreement_items
      where listing_request_agreement_items.agreement_id =
          new_agreement_id
        and listing_request_agreement_items.item_type =
          'milestone'
        and not exists (
          select 1
          from public.listing_request_payment_schedule_items
          where listing_request_payment_schedule_items.agreement_item_id =
            listing_request_agreement_items.id
        )
    ) then
      raise exception
        'Every milestone must have a matching payment schedule item.'
        using errcode = 'P0001';
    end if;

    select coalesce(sum(amount), 0)
    into milestone_payment_total
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.agreement_id =
        new_agreement_id
      and listing_request_payment_schedule_items.payment_timing =
        'due_at_milestone_approval';

    if round(milestone_item_total, 2)
      <> round(p_total_amount, 2) then
      raise exception
        'Milestone item amounts must equal the agreement total.'
        using errcode = 'P0001';
    end if;

    if round(milestone_payment_total, 2)
      <> round(p_total_amount, 2) then
      raise exception
        'Milestone payment amounts must equal the agreement total.'
        using errcode = 'P0001';
    end if;
  end if;

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
  where listing_request_agreements.id =
    new_agreement_id;
end;
$$;