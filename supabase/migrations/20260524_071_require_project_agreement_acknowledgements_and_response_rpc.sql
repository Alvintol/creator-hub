create table if not exists public.listing_request_agreement_acknowledgements (
  id uuid primary key default gen_random_uuid(),

  agreement_id uuid not null references public.listing_request_agreements(id) on delete cascade,
  buyer_user_id uuid not null,

  acknowledgement_key text not null check (
    char_length(btrim(acknowledgement_key)) >= 3
    and char_length(btrim(acknowledgement_key)) <= 200
  ),

  acknowledgement_label text not null check (
    char_length(btrim(acknowledgement_label)) >= 3
    and char_length(btrim(acknowledgement_label)) <= 500
  ),

  created_at timestamptz not null default now(),

  unique (agreement_id, buyer_user_id, acknowledgement_key)
);

create index if not exists listing_request_agreement_acknowledgements_agreement_idx
on public.listing_request_agreement_acknowledgements(agreement_id);

create index if not exists listing_request_agreement_acknowledgements_buyer_idx
on public.listing_request_agreement_acknowledgements(buyer_user_id);

alter table public.listing_request_agreement_acknowledgements enable row level security;

drop policy if exists "agreement participants can read acknowledgements"
on public.listing_request_agreement_acknowledgements;

create policy "agreement participants can read acknowledgements"
on public.listing_request_agreement_acknowledgements
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.id = listing_request_agreement_acknowledgements.agreement_id
      and (
        listing_request_agreements.buyer_user_id = auth.uid()
        or listing_request_agreements.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
      )
  )
);

drop function if exists public.respond_listing_request_agreement(uuid, text, text[]);

create or replace function public.respond_listing_request_agreement(
  p_agreement_id uuid,
  p_response text,
  p_acknowledgement_keys text[] default '{}'::text[]
)
returns table (
  id uuid,
  status text,
  starting_payment_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
  missing_acknowledgement_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to respond to a project agreement.'
      using errcode = '42501';
  end if;

  if p_response not in ('buyer_accepted', 'buyer_declined') then
    raise exception 'Agreement response must be buyer_accepted or buyer_declined.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id
    and listing_request_agreements.buyer_user_id = auth.uid()
    and listing_request_agreements.status = 'sent'
  for update;

  if not found then
    raise exception 'This project agreement is not available for your response.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.status = 'accepted'
      and listing_requests.buyer_user_id = auth.uid()
  ) then
    raise exception 'This request is not ready for agreement response.'
      using errcode = 'P0001';
  end if;

  if p_response = 'buyer_accepted' then
    with required_acknowledgements as (
      select
        'agreement:scope_summary'::text as acknowledgement_key,
        'I understand the project scope summary.'::text as acknowledgement_label

      union all

      select
        'scope_item:' || listing_request_agreement_items.id::text,
        'I understand this scope item: ' || listing_request_agreement_items.title
      from public.listing_request_agreement_items
      where listing_request_agreement_items.agreement_id = p_agreement_id
        and listing_request_agreement_items.is_required = true
        and listing_request_agreement_items.is_selected = true

      union all

      select
        'agreement:payment_schedule',
        'I understand the payment schedule.'

      union all

      select
        'payment_item:' || listing_request_payment_schedule_items.id::text,
        'I understand this payment item: ' || listing_request_payment_schedule_items.title
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id = p_agreement_id

      union all

      select
        'agreement:timeline',
        'I understand the estimated completion date and buyer-side hold rules.'

      union all

      select
        'agreement:update_schedule',
        'I understand the creator update schedule.'

      union all

      select
        'agreement:revision_policy',
        'I understand the included revision policy.'

      union all

      select
        'agreement:additional_cost_policy',
        'I understand the additional cost policy.'

      union all

      select
        'agreement:change_orders',
        'I understand scope, price, timeline, deliverable, or payment changes require an accepted change order.'

      union all

      select
        'agreement:final_release_payment',
        'I understand final files or deliverables may be held until required payments are complete.'
    )
    select count(*)
    into missing_acknowledgement_count
    from required_acknowledgements
    where not exists (
      select 1
      from unnest(coalesce(p_acknowledgement_keys, '{}'::text[])) as checked_keys(acknowledgement_key)
      where checked_keys.acknowledgement_key = required_acknowledgements.acknowledgement_key
    );

    if missing_acknowledgement_count > 0 then
      raise exception 'You must acknowledge every required agreement item before accepting.'
        using errcode = 'P0001';
    end if;

    with required_acknowledgements as (
      select
        'agreement:scope_summary'::text as acknowledgement_key,
        'I understand the project scope summary.'::text as acknowledgement_label

      union all

      select
        'scope_item:' || listing_request_agreement_items.id::text,
        'I understand this scope item: ' || listing_request_agreement_items.title
      from public.listing_request_agreement_items
      where listing_request_agreement_items.agreement_id = p_agreement_id
        and listing_request_agreement_items.is_required = true
        and listing_request_agreement_items.is_selected = true

      union all

      select
        'agreement:payment_schedule',
        'I understand the payment schedule.'

      union all

      select
        'payment_item:' || listing_request_payment_schedule_items.id::text,
        'I understand this payment item: ' || listing_request_payment_schedule_items.title
      from public.listing_request_payment_schedule_items
      where listing_request_payment_schedule_items.agreement_id = p_agreement_id

      union all

      select
        'agreement:timeline',
        'I understand the estimated completion date and buyer-side hold rules.'

      union all

      select
        'agreement:update_schedule',
        'I understand the creator update schedule.'

      union all

      select
        'agreement:revision_policy',
        'I understand the included revision policy.'

      union all

      select
        'agreement:additional_cost_policy',
        'I understand the additional cost policy.'

      union all

      select
        'agreement:change_orders',
        'I understand scope, price, timeline, deliverable, or payment changes require an accepted change order.'

      union all

      select
        'agreement:final_release_payment',
        'I understand final files or deliverables may be held until required payments are complete.'
    )
    insert into public.listing_request_agreement_acknowledgements (
      agreement_id,
      buyer_user_id,
      acknowledgement_key,
      acknowledgement_label
    )
    select
      p_agreement_id,
      auth.uid(),
      required_acknowledgements.acknowledgement_key,
      required_acknowledgements.acknowledgement_label
    from required_acknowledgements
    on conflict (agreement_id, buyer_user_id, acknowledgement_key)
    do update set acknowledgement_label = excluded.acknowledgement_label;
  end if;

  update public.listing_request_agreements
  set
    status = p_response,
    buyer_accepted_at = case
      when p_response = 'buyer_accepted' then now()
      else buyer_accepted_at
    end,
    buyer_declined_at = case
      when p_response = 'buyer_declined' then now()
      else buyer_declined_at
    end
  where listing_request_agreements.id = p_agreement_id;

  update public.listing_request_timeline_holds
  set ended_at = now()
  where listing_request_timeline_holds.agreement_id = p_agreement_id
    and listing_request_timeline_holds.reason = 'agreement_acceptance_pending'
    and listing_request_timeline_holds.ended_at is null;

  if p_response = 'buyer_accepted'
    and agreement_row.starting_payment_status = 'payment_required'
  then
    insert into public.listing_request_timeline_holds (
      listing_request_id,
      agreement_id,
      reason,
      started_at
    )
    values (
      agreement_row.listing_request_id,
      agreement_row.id,
      'starting_payment_pending',
      now()
    )
    on conflict do nothing;
  end if;

  return query
  select
    listing_request_agreements.id,
    listing_request_agreements.status,
    listing_request_agreements.starting_payment_status
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id;
end;
$$;

grant execute on function public.respond_listing_request_agreement(
  uuid,
  text,
  text[]
) to authenticated;