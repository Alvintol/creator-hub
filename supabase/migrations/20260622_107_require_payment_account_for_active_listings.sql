create or replace function public.enforce_listing_payment_account_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
    and new.is_active = true
    and not public.has_ready_creator_payment_account(new.user_id)
  then
    raise exception 'Creator payout account must be ready before publishing active listings.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_require_payment_account_for_active_publish
  on public.listings;

create trigger listings_require_payment_account_for_active_publish
  before insert or update of user_id, status, is_active
  on public.listings
  for each row
  execute function public.enforce_listing_payment_account_readiness();