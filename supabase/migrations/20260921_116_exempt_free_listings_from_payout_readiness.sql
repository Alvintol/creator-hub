-- Free listings never touch Stripe: they serve a file the creator uploaded or
-- send the buyer to an external link (20260919_115_add_free_listings.sql).
-- The payout-readiness trigger predates them and gates *every* active published
-- listing on a ready connected account, so a creator who only wants to give a
-- file away is forced through full Stripe identity onboarding -- bank details and
-- tax information -- to publish something that can never take a payment.
--
-- Exempt free listings. Readiness still applies the moment a listing is not free,
-- including when an existing free listing is flipped to paid, because the trigger
-- re-runs on that update.
create or replace function public.enforce_listing_payment_account_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
    and new.is_active = true
    and new.is_free = false
    and not public.has_ready_creator_payment_account(new.user_id)
  then
    raise exception 'Creator payout account must be ready before publishing active listings.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- The original trigger did not watch is_free, so flipping a published free
-- listing to paid would have skipped the readiness check entirely.
drop trigger if exists listings_require_payment_account_for_active_publish
  on public.listings;

create trigger listings_require_payment_account_for_active_publish
  before insert or update of user_id, status, is_active, is_free
  on public.listings
  for each row
  execute function public.enforce_listing_payment_account_readiness();
