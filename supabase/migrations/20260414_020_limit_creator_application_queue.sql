-- Limit the open creator application review queue to 10
-- Count only actively occupying review states:
-- - submitted
-- - under_review
--
-- Drafts do not count.
-- Needs-changes does not count because it is waiting on the applicant.

drop function if exists public.get_creator_application_queue_state();
drop function if exists public.submit_seller_application(uuid);

create or replace function public.get_creator_application_queue_state()
returns table (
  open_count integer,
  max_open integer,
  remaining integer,
  has_capacity boolean
)
language sql
security definer
set search_path = public
as $$
  with queue_state as (
    select count(*)::integer as open_count
    from public.seller_applications
    where status in ('submitted', 'under_review')
  )
  select
    queue_state.open_count,
    10::integer as max_open,
    greatest(10::integer - queue_state.open_count, 0) as remaining,
    queue_state.open_count < 10::integer as has_capacity
  from queue_state;
$$;

revoke all on function public.get_creator_application_queue_state() from public;
grant execute on function public.get_creator_application_queue_state() to authenticated;

create or replace function public.submit_seller_application(application_id uuid)
returns public.seller_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  queue_open_count integer;
  updated_row public.seller_applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  -- Serialize submissions so two users cannot both slip in at the same time
  perform pg_advisory_xact_lock(90421001);

  select count(*)::integer
  into queue_open_count
  from public.seller_applications
  where status in ('submitted', 'under_review');

  if queue_open_count >= 10 then
    raise exception 'Creator applications are full right now. Please check again later.';
  end if;

  update public.seller_applications
  set
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
  where id = application_id
    and profile_user_id = auth.uid()
    and status in ('draft', 'needs_changes')
  returning *
  into updated_row;

  if updated_row.id is null then
    raise exception 'Application could not be submitted. Only draft or needs-changes applications can be submitted.';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.submit_seller_application(uuid) from public;
grant execute on function public.submit_seller_application(uuid) to authenticated;