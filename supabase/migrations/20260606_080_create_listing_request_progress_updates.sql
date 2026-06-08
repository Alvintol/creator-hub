create table if not exists public.listing_request_progress_updates (
  id uuid primary key default gen_random_uuid(),
  listing_request_id uuid not null
    references public.listing_requests(id)
    on delete cascade,
  agreement_id uuid not null
    references public.listing_request_agreements(id)
    on delete cascade,
  creator_user_id uuid not null,
  update_kind text not null default 'progress'
    check (
      update_kind in (
        'progress',
        'milestone',
        'delay',
        'final_preview'
      )
    ),
  title text not null
    check (
      char_length(btrim(title)) >= 3
      and char_length(btrim(title)) <= 160
    ),
  body text not null
    check (
      char_length(btrim(body)) >= 10
      and char_length(btrim(body)) <= 4000
    ),
  progress_percent integer null
    check (
      progress_percent is null
      or (
        progress_percent >= 0
        and progress_percent <= 100
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_request_progress_updates_request_idx
on public.listing_request_progress_updates(listing_request_id, created_at desc);

create index if not exists listing_request_progress_updates_agreement_idx
on public.listing_request_progress_updates(agreement_id, created_at desc);

drop trigger if exists listing_request_progress_updates_set_updated_at
on public.listing_request_progress_updates;

create trigger listing_request_progress_updates_set_updated_at
before update on public.listing_request_progress_updates
for each row
execute function public.set_updated_at();

alter table public.listing_request_progress_updates
enable row level security;

drop policy if exists "request participants can read progress updates"
on public.listing_request_progress_updates;

create policy "request participants can read progress updates"
on public.listing_request_progress_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
      listing_request_progress_updates.listing_request_id
      and (
        listing_requests.buyer_user_id = auth.uid()
        or listing_requests.creator_user_id = auth.uid()
        or exists (
          select 1
          from public.admin_roles
          where admin_roles.profile_user_id = auth.uid()
        )
      )
  )
);

drop function if exists public.create_listing_request_progress_update(
  uuid,
  text,
  text,
  text,
  integer
);

create or replace function public.create_listing_request_progress_update(
  p_agreement_id uuid,
  p_update_kind text,
  p_title text,
  p_body text,
  p_progress_percent integer default null
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  creator_user_id uuid,
  update_kind text,
  title text,
  body text,
  progress_percent integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_row public.listing_request_agreements%rowtype;
  request_status text;
  conversation_id uuid;
  created_update public.listing_request_progress_updates%rowtype;
  clean_title text := btrim(coalesce(p_title, ''));
  clean_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to post a progress update.'
      using errcode = '42501';
  end if;

  if p_update_kind not in (
    'progress',
    'milestone',
    'delay',
    'final_preview'
  ) then
    raise exception 'Choose a valid progress update type.'
      using errcode = '22023';
  end if;

  if char_length(clean_title) < 3
    or char_length(clean_title) > 160 then
    raise exception 'Progress update title must be between 3 and 160 characters.'
      using errcode = '22023';
  end if;

  if char_length(clean_body) < 10
    or char_length(clean_body) > 4000 then
    raise exception 'Progress update details must be between 10 and 4000 characters.'
      using errcode = '22023';
  end if;

  if p_progress_percent is not null
    and (
      p_progress_percent < 0
      or p_progress_percent > 100
    ) then
    raise exception 'Progress percentage must be between 0 and 100.'
      using errcode = '22023';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id
    and listing_request_agreements.creator_user_id = auth.uid()
    and listing_request_agreements.status = 'buyer_accepted'
    and listing_request_agreements.starting_payment_status <>
      'payment_required';

  if not found then
    raise exception 'This agreement is not ready for progress updates.'
      using errcode = 'P0001';
  end if;

  select listing_requests.status
  into request_status
  from public.listing_requests
  where listing_requests.id = agreement_row.listing_request_id
    and listing_requests.creator_user_id = auth.uid();

  if request_status is distinct from 'accepted' then
    raise exception 'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  insert into public.listing_request_progress_updates (
    listing_request_id,
    agreement_id,
    creator_user_id,
    update_kind,
    title,
    body,
    progress_percent
  )
  values (
    agreement_row.listing_request_id,
    agreement_row.id,
    auth.uid(),
    p_update_kind,
    clean_title,
    clean_body,
    p_progress_percent
  )
  returning *
  into created_update;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id =
    agreement_row.listing_request_id
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
        'The creator posted a project progress update: %s',
        clean_title
      )
    );
  end if;

  return query
  select
    created_update.id,
    created_update.listing_request_id,
    created_update.agreement_id,
    created_update.creator_user_id,
    created_update.update_kind,
    created_update.title,
    created_update.body,
    created_update.progress_percent,
    created_update.created_at;
end;
$$;

grant execute on function public.create_listing_request_progress_update(
  uuid,
  text,
  text,
  text,
  integer
)
to authenticated;