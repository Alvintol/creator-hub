drop function if exists
public.submit_listing_request_milestone(
  uuid,
  text,
  text[]
);

create or replace function
public.submit_listing_request_milestone(
  p_milestone_id uuid,
  p_summary text,
  p_delivery_links text[] default '{}'::text[]
)
returns table (
  submission_id uuid,
  milestone_id uuid,
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
  milestone_row
    public.listing_request_milestones%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  payment_row
    public.listing_request_payment_schedule_items%rowtype;

  clean_summary text :=
    btrim(coalesce(p_summary, ''));

  normalized_delivery_links text[] :=
    '{}'::text[];

  next_version_number integer;
  new_submission_id uuid;
  submitted_time timestamptz := now();

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to submit a milestone.'
      using errcode = '42501';
  end if;

  if char_length(clean_summary) < 10
    or char_length(clean_summary) > 4000 then
    raise exception
      'Milestone submission summary must be between 10 and 4000 characters.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(btrim(delivery_link)),
    '{}'::text[]
  )
  into normalized_delivery_links
  from unnest(
    coalesce(
      p_delivery_links,
      '{}'::text[]
    )
  ) as delivery_link
  where btrim(delivery_link) <> '';

  if cardinality(normalized_delivery_links) > 20 then
    raise exception
      'A milestone submission can contain no more than 20 delivery links.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      normalized_delivery_links
    ) as delivery_link
    where char_length(delivery_link) > 2000
  ) then
    raise exception
      'Each milestone delivery link must be 2000 characters or fewer.'
      using errcode = '22023';
  end if;

  select *
  into milestone_row
  from public.listing_request_milestones
  where listing_request_milestones.id =
      p_milestone_id
    and listing_request_milestones.creator_user_id =
      auth.uid()
    and listing_request_milestones.status in (
      'pending',
      'revision_requested'
    )
  for update;

  if not found then
    raise exception
      'This milestone is not available for submission.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      milestone_row.agreement_id
    and listing_request_agreements.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_agreements.creator_user_id =
      auth.uid()
    and listing_request_agreements.status =
      'buyer_accepted'
    and listing_request_agreements.payment_structure =
      'milestone_payments'
  for update;

  if not found then
    raise exception
      'The accepted milestone agreement could not be found.'
      using errcode = 'P0001';
  end if;

  if agreement_row.starting_payment_status not in (
    'paid',
    'not_required'
  ) then
    raise exception
      'The starting payment must be resolved before milestone work can be submitted.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
        milestone_row.listing_request_id
      and listing_requests.creator_user_id =
        auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  select *
  into payment_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
      milestone_row.payment_schedule_item_id
    and listing_request_payment_schedule_items.agreement_id =
      milestone_row.agreement_id
    and listing_request_payment_schedule_items.agreement_item_id =
      milestone_row.agreement_item_id
    and listing_request_payment_schedule_items.payment_timing =
      'due_at_milestone_approval'
    and listing_request_payment_schedule_items.status =
      'pending'
  for update;

  if not found then
    raise exception
      'The pending milestone payment could not be found.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_milestones
    where listing_request_milestones.agreement_id =
        milestone_row.agreement_id
      and listing_request_milestones.sort_order <
        milestone_row.sort_order
      and listing_request_milestones.status not in (
        'paid',
        'cancelled'
      )
  ) then
    raise exception
      'Earlier milestones must be completed before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_milestones
    where listing_request_milestones.agreement_id =
        milestone_row.agreement_id
      and listing_request_milestones.id <>
        milestone_row.id
      and listing_request_milestones.status in (
        'submitted',
        'buyer_approved',
        'payment_required'
      )
  ) then
    raise exception
      'Another milestone must be resolved before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_timeline_holds
    where listing_request_timeline_holds.agreement_id =
        milestone_row.agreement_id
      and listing_request_timeline_holds.ended_at
        is null
  ) then
    raise exception
      'The project has an unresolved hold that must be completed before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_milestone_submissions
    where listing_request_milestone_submissions.milestone_id =
        milestone_row.id
      and listing_request_milestone_submissions.status =
        'submitted'
  ) then
    raise exception
      'This milestone already has a submission awaiting buyer review.'
      using errcode = 'P0001';
  end if;

  select coalesce(
    max(
      listing_request_milestone_submissions.version_number
    ),
    0
  ) + 1
  into next_version_number
  from public.listing_request_milestone_submissions
  where listing_request_milestone_submissions.milestone_id =
    milestone_row.id;

  insert into
  public.listing_request_milestone_submissions (
    milestone_id,
    listing_request_id,
    agreement_id,
    creator_user_id,
    buyer_user_id,
    version_number,
    status,
    summary,
    delivery_links,
    submitted_at
  )
  values (
    milestone_row.id,
    milestone_row.listing_request_id,
    milestone_row.agreement_id,
    milestone_row.creator_user_id,
    milestone_row.buyer_user_id,
    next_version_number,
    'submitted',
    clean_summary,
    normalized_delivery_links,
    submitted_time
  )
  returning
    listing_request_milestone_submissions.id
  into new_submission_id;

  update public.listing_request_milestones
  set
    status = 'submitted',
    submission_version =
      next_version_number,
    latest_submitted_at =
      submitted_time
  where listing_request_milestones.id =
    milestone_row.id;

  insert into public.listing_request_timeline_holds (
    listing_request_id,
    agreement_id,
    payment_schedule_item_id,
    reason,
    started_at
  )
  values (
    milestone_row.listing_request_id,
    milestone_row.agreement_id,
    milestone_row.payment_schedule_item_id,
    'milestone_approval_pending',
    submitted_time
  )
  on conflict do nothing;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id =
    milestone_row.listing_request_id
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
        'The creator submitted milestone %s for buyer review: %s',
        milestone_row.sort_order + 1,
        milestone_row.title
      )
    );
  end if;

  return query
  select
    milestone_submission.id,
    milestone_submission.milestone_id,
    milestone_submission.listing_request_id,
    milestone_submission.agreement_id,
    milestone_submission.status,
    milestone_submission.version_number,
    milestone_submission.submitted_at
  from public.listing_request_milestone_submissions
    as milestone_submission
  where milestone_submission.id =
    new_submission_id;
end;
$$;

grant execute on function
public.submit_listing_request_milestone(
  uuid,
  text,
  text[]
)
to authenticated;