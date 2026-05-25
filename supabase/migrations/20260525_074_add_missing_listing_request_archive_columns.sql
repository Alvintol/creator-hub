-- Adds archive metadata expected by request list/detail hooks.
-- Safe to run even if the columns already exist.

alter table public.listing_requests
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by_user_id uuid null;

-- Backfill archived_at for historical archived rows.
update public.listing_requests
set archived_at = coalesce(archived_at, updated_at, now())
where status = 'archived'
  and archived_at is null;

create or replace function public.set_listing_request_archive_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'archived' then
      new.archived_at := coalesce(new.archived_at, now());
      new.archived_by_user_id := coalesce(new.archived_by_user_id, auth.uid());
    else
      new.archived_at := null;
      new.archived_by_user_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_set_archive_metadata
on public.listing_requests;

create trigger listing_requests_set_archive_metadata
before update of status
on public.listing_requests
for each row
execute function public.set_listing_request_archive_metadata();

notify pgrst, 'reload schema';