alter table public.listing_request_agreements
add column if not exists last_progress_update_at timestamptz null;

alter table public.listing_request_agreements
add column if not exists next_progress_update_due_at timestamptz null;

alter table public.listing_request_agreements
add column if not exists progress_update_requirement_satisfied_at timestamptz null;

create index if not exists listing_request_agreements_next_progress_update_due_idx
on public.listing_request_agreements(next_progress_update_due_at)
where
  status = 'buyer_accepted'
  and next_progress_update_due_at is not null;

create or replace function public.refresh_listing_request_agreement_progress_schedule(
  p_agreement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
  first_update_at timestamptz;
  latest_update_at timestamptz;
  progress_update_count integer;
  next_update_due_at timestamptz;
  requirement_satisfied_at timestamptz;
begin
  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    min(listing_request_progress_updates.created_at),
    max(listing_request_progress_updates.created_at)
  into
    progress_update_count,
    first_update_at,
    latest_update_at
  from public.listing_request_progress_updates
  where listing_request_progress_updates.agreement_id = p_agreement_id;

  requirement_satisfied_at :=
    case
      when agreement_row.minimum_update_rule = 'single_progress_update'
        and progress_update_count > 0
      then coalesce(
        agreement_row.progress_update_requirement_satisfied_at,
        first_update_at
      )
      else null
    end;

  if
    agreement_row.status <> 'buyer_accepted'
    or agreement_row.starting_payment_status = 'payment_required'
    or agreement_row.estimated_start_at is null
  then
    update public.listing_request_agreements
    set
      last_progress_update_at = latest_update_at,
      next_progress_update_due_at = null,
      progress_update_requirement_satisfied_at =
        requirement_satisfied_at
    where listing_request_agreements.id = p_agreement_id;

    return;
  end if;

  if agreement_row.minimum_update_rule = 'single_progress_update' then
    next_update_due_at :=
      case
        when progress_update_count > 0 then null
        else agreement_row.adjusted_estimated_completion_at
      end;
  else
    next_update_due_at :=
      case
        when latest_update_at is not null
        then
          latest_update_at
          + make_interval(
              days => coalesce(
                agreement_row.update_frequency_days,
                7
              )
            )
        else
          agreement_row.estimated_start_at
          + make_interval(
              days => coalesce(
                agreement_row.first_update_due_days,
                5
              )
            )
      end;
  end if;

  update public.listing_request_agreements
  set
    last_progress_update_at = latest_update_at,
    next_progress_update_due_at = next_update_due_at,
    progress_update_requirement_satisfied_at =
      requirement_satisfied_at
  where listing_request_agreements.id = p_agreement_id;
end;
$$;

create or replace function public.sync_listing_request_progress_update_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_listing_request_agreement_progress_schedule(
    new.agreement_id
  );

  return new;
end;
$$;

drop trigger if exists listing_request_progress_updates_sync_schedule
on public.listing_request_progress_updates;

create trigger listing_request_progress_updates_sync_schedule
after insert on public.listing_request_progress_updates
for each row
execute function public.sync_listing_request_progress_update_schedule();

create or replace function public.sync_listing_request_agreement_progress_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_listing_request_agreement_progress_schedule(
    new.id
  );

  return new;
end;
$$;

drop trigger if exists listing_request_agreements_sync_progress_schedule
on public.listing_request_agreements;

create trigger listing_request_agreements_sync_progress_schedule
after update of
  status,
  starting_payment_status,
  estimated_start_at,
  adjusted_estimated_completion_at,
  minimum_update_rule,
  first_update_due_days,
  update_frequency_days
on public.listing_request_agreements
for each row
execute function public.sync_listing_request_agreement_progress_schedule();

do $$
declare
  agreement_record record;
begin
  for agreement_record in
    select listing_request_agreements.id
    from public.listing_request_agreements
  loop
    perform public.refresh_listing_request_agreement_progress_schedule(
      agreement_record.id
    );
  end loop;
end;
$$;