-- Adds indexes for request-linked conversation inboxes.
-- These support client, creator, and admin request inbox ordering by latest conversation activity.

create index if not exists conversations_buyer_type_updated_at_idx
on public.conversations using btree (
  buyer_user_id,
  conversation_type,
  updated_at desc
);

create index if not exists conversations_creator_type_updated_at_idx
on public.conversations using btree (
  creator_user_id,
  conversation_type,
  updated_at desc
);

create index if not exists conversations_type_updated_at_idx
on public.conversations using btree (
  conversation_type,
  updated_at desc
);