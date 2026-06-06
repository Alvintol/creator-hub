drop policy if exists "agreement participants can read agreements"
on public.listing_request_agreements;

create policy "agreement participants can read agreements"
on public.listing_request_agreements
for select
to authenticated
using (
  creator_user_id = auth.uid()
  or exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = auth.uid()
  )
  or (
    buyer_user_id = auth.uid()
    and status in ('sent', 'buyer_accepted', 'buyer_declined')
  )
);

drop policy if exists "agreement participants can read agreement items"
on public.listing_request_agreement_items;

create policy "agreement participants can read agreement items"
on public.listing_request_agreement_items
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.id = listing_request_agreement_items.agreement_id
      and (
        listing_request_agreements.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
        or (
          listing_request_agreements.buyer_user_id = auth.uid()
          and listing_request_agreements.status in (
            'sent',
            'buyer_accepted',
            'buyer_declined'
          )
        )
      )
  )
);

drop policy if exists "agreement participants can read payment schedule items"
on public.listing_request_payment_schedule_items;

create policy "agreement participants can read payment schedule items"
on public.listing_request_payment_schedule_items
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_request_agreements
    where listing_request_agreements.id = listing_request_payment_schedule_items.agreement_id
      and (
        listing_request_agreements.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
        or (
          listing_request_agreements.buyer_user_id = auth.uid()
          and listing_request_agreements.status in (
            'sent',
            'buyer_accepted',
            'buyer_declined'
          )
        )
      )
  )
);