-- supabase/migrations/20260525_074_send_draft_listing_request_agreement_rpc.sql

drop function if exists public.send_draft_listing_request_agreement(uuid);

create or replace function public.send_draft_listing_request_agreement(
  p_agreement_id uuid
)
returns table (
  id uuid,
  status text,
  sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send a project agreement.'
      using errcode = '42501';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id
    and listing_request_agreements.creator_user_id = auth.uid()
    and listing_request_agreements.status = 'draft'
  for update;

  if not found then
    raise exception 'This draft project agreement is not available to send.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id = agreement_row.listing_request_id
      and listing_requests.creator_user_id = auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception 'This request is not ready for a project agreement.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_agreements
  set
    status = 'sent',
    sent_at = coalesce(sent_at, now())
  where listing_request_agreements.id = p_agreement_id;

  insert into public.listing_request_timeline_holds (
    listing_request_id,
    agreement_id,
    reason,
    started_at
  )
  values (
    agreement_row.listing_request_id,
    agreement_row.id,
    'agreement_acceptance_pending',
    now()
  )
  on conflict do nothing;

  return query
  select
    listing_request_agreements.id,
    listing_request_agreements.status,
    listing_request_agreements.sent_at
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id;
end;
$$;

grant execute on function public.send_draft_listing_request_agreement(uuid)
to authenticated;