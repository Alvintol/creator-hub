drop function if exists
public.respond_listing_request_milestone(
  uuid,
  text,
  text
);

create or replace function
public.respond_listing_request_milestone(
  p_milestone_id uuid,
  p_response text,
  p_revision_request_reason text default null
)
returns table (
  submission_id uuid,
  milestone_id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  response_status text,
  milestone_status text,
  payment_status text,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row
    public.listing_request_milestones%rowtype;

  submission_row
    public.listing_request_milestone_submissions%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  payment_row
    public.listing_request_payment_schedule_items%rowtype;

  clean_response text :=
    btrim(coalesce(p_response, ''));

  clean_revision_reason text :=
    nullif(
      btrim(
        coalesce(
          p_revision_request_reason,
          ''
        )
      ),
      ''
    );

  response_time timestamptz := now();

  next_milestone_status text;
  next_payment_status text := 'pending';

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to respond to a milestone.'
      using errcode = '42501';
  end if;

  if clean_response not in (
    'buyer_approved',
    'revision_requested'
  ) then
    raise exception
      'Milestone response must be buyer_approved or revision_requested.'
      using errcode = '22023';
  end if;

  if clean_response = 'revision_requested' then
    if clean_revision_reason is null
      or char_length(clean_revision_reason) < 10
      or char_length(clean_revision_reason) > 2000 then
      raise exception
        'Revision request reason must be between 10 and 2000 characters.'
        using errcode = '22023';
    end if;
  end if;

  if clean_response = 'buyer_approved'
    and clean_revision_reason is not null then
    raise exception
      'Approval responses cannot include a revision request reason.'
      using errcode = '22023';
  end if;

  select *
  into milestone_row
  from public.listing_request_milestones
  where listing_request_milestones.id =
      p_milestone_id
    and listing_request_milestones.buyer_user_id =
      auth.uid()
    and listing_request_milestones.status =
      'submitted'
  for update;

  if not found then
    raise exception
      'This milestone is not awaiting your response.'
      using errcode = 'P0001';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      milestone_row.agreement_id
    and listing_request_agreements.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_agreements.buyer_user_id =
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

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
        milestone_row.listing_request_id
      and listing_requests.buyer_user_id =
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

  select *
  into submission_row
  from public.listing_request_milestone_submissions
  where listing_request_milestone_submissions.milestone_id =
      milestone_row.id
    and listing_request_milestone_submissions.status =
      'submitted'
  order by
    listing_request_milestone_submissions.version_number desc
  limit 1
  for update;

  if not found then
    raise exception
      'The submitted milestone version could not be found.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_timeline_holds
  set ended_at = response_time
  where listing_request_timeline_holds.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_timeline_holds.agreement_id =
      milestone_row.agreement_id
    and listing_request_timeline_holds.payment_schedule_item_id =
      milestone_row.payment_schedule_item_id
    and listing_request_timeline_holds.reason =
      'milestone_approval_pending'
    and listing_request_timeline_holds.ended_at
      is null;

  if clean_response = 'revision_requested' then
    update public.listing_request_milestone_submissions
    set
      status = 'revision_requested',
      revision_request_reason =
        clean_revision_reason,
      revision_requested_at =
        response_time
    where listing_request_milestone_submissions.id =
      submission_row.id;

    update public.listing_request_milestones
    set
      status = 'revision_requested',
      latest_revision_requested_at =
        response_time
    where listing_request_milestones.id =
      milestone_row.id;

    next_milestone_status :=
      'revision_requested';

    next_payment_status := payment_row.status;
  else
    update public.listing_request_milestone_submissions
    set
      status = 'buyer_approved',
      buyer_approved_at = response_time
    where listing_request_milestone_submissions.id =
      submission_row.id;

    update public.listing_request_payment_schedule_items
    set
      status = 'payment_required',
      due_at = coalesce(
        listing_request_payment_schedule_items.due_at,
        response_time
      )
    where listing_request_payment_schedule_items.id =
      payment_row.id;

    update public.listing_request_milestones
    set
      status = 'payment_required',
      buyer_approved_at = response_time,
      payment_required_at = response_time
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
      'milestone_payment_pending',
      response_time
    )
    on conflict do nothing;

    next_milestone_status :=
      'payment_required';

    next_payment_status :=
      'payment_required';
  end if;

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
      case
        when clean_response =
          'revision_requested'
          then format(
            'The buyer requested revisions for milestone %s: %s',
            milestone_row.sort_order + 1,
            milestone_row.title
          )
        else format(
          'The buyer approved milestone %s: %s. The milestone payment is now required.',
          milestone_row.sort_order + 1,
          milestone_row.title
        )
      end
    );
  end if;

  return query
  select
    submission_row.id,
    milestone_row.id,
    milestone_row.listing_request_id,
    milestone_row.agreement_id,
    clean_response,
    next_milestone_status,
    next_payment_status,
    response_time;
end;
$$;

grant execute on function
public.respond_listing_request_milestone(
  uuid,
  text,
  text
)
to authenticated;