-- Generic messaging foundation for CreatorHub.
-- Supports request-linked conversations now and creator/listing inquiries later.

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_roles
    where admin_roles.profile_user_id = p_user_id
      and admin_roles.role = 'admin'
  );
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;


create table public.conversations (
  id uuid not null default gen_random_uuid(),

  conversation_type text not null,

  buyer_user_id uuid not null,
  creator_user_id uuid not null,
  created_by_user_id uuid not null,

  listing_id uuid null,
  listing_request_id uuid null,

  subject text null,
  initiation_reason_code text null,
  initiation_reason_details text null,

  status text not null default 'open',

  closed_at timestamp with time zone null,
  closed_by_user_id uuid null,
  closed_reason_code text null,
  closed_reason_details text null,

  admin_locked_at timestamp with time zone null,
  admin_locked_by_user_id uuid null,

  buyer_image_upload_status text not null default 'blocked',
  buyer_image_upload_requested_at timestamp with time zone null,
  buyer_image_upload_requested_by_user_id uuid null,
  buyer_image_upload_request_note text null,
  buyer_image_upload_approved_at timestamp with time zone null,
  buyer_image_upload_approved_by_user_id uuid null,
  buyer_image_upload_revoked_at timestamp with time zone null,
  buyer_image_upload_revoked_by_user_id uuid null,

  last_message_at timestamp with time zone null,
  last_message_sender_user_id uuid null,
  last_message_preview text null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint conversations_pkey primary key (id),

  constraint conversations_buyer_user_id_fkey
    foreign key (buyer_user_id) references auth.users (id),

  constraint conversations_creator_user_id_fkey
    foreign key (creator_user_id) references auth.users (id),

  constraint conversations_created_by_user_id_fkey
    foreign key (created_by_user_id) references auth.users (id),

  constraint conversations_listing_id_fkey
    foreign key (listing_id) references public.listings (id),

  constraint conversations_listing_request_id_fkey
    foreign key (listing_request_id)
    references public.listing_requests (id)
    on delete cascade,

  constraint conversations_closed_by_user_id_fkey
    foreign key (closed_by_user_id) references auth.users (id),

  constraint conversations_admin_locked_by_user_id_fkey
    foreign key (admin_locked_by_user_id) references auth.users (id),

  constraint conversations_buyer_image_upload_requested_by_user_id_fkey
    foreign key (buyer_image_upload_requested_by_user_id) references auth.users (id),

  constraint conversations_buyer_image_upload_approved_by_user_id_fkey
    foreign key (buyer_image_upload_approved_by_user_id) references auth.users (id),

  constraint conversations_buyer_image_upload_revoked_by_user_id_fkey
    foreign key (buyer_image_upload_revoked_by_user_id) references auth.users (id),

  constraint conversations_last_message_sender_user_id_fkey
    foreign key (last_message_sender_user_id) references auth.users (id),

  constraint conversations_listing_request_id_key unique (listing_request_id),

  constraint conversations_type_check
    check (
      conversation_type = any (
        array[
          'creator_inquiry'::text,
          'listing_inquiry'::text,
          'listing_request'::text
        ]
      )
    ),

  constraint conversations_context_check
    check (
      (
        conversation_type = 'creator_inquiry'
        and listing_id is null
        and listing_request_id is null
      )
      or
      (
        conversation_type = 'listing_inquiry'
        and listing_id is not null
        and listing_request_id is null
      )
      or
      (
        conversation_type = 'listing_request'
        and listing_id is not null
        and listing_request_id is not null
      )
    ),

  constraint conversations_buyer_creator_check
    check (buyer_user_id <> creator_user_id),

  constraint conversations_created_by_participant_check
    check (
      created_by_user_id = buyer_user_id
      or created_by_user_id = creator_user_id
    ),

  constraint conversations_subject_check
    check (
      subject is null
      or char_length(btrim(subject)) <= 120
    ),

  constraint conversations_initiation_reason_code_check
    check (
      initiation_reason_code is null
      or initiation_reason_code = any (
        array[
          'custom_quote'::text,
          'style_fit'::text,
          'scope_or_complexity'::text,
          'timeline_availability'::text,
          'pricing'::text,
          'deliverables'::text,
          'usage_rights'::text,
          'colour_or_variation'::text,
          'before_requesting'::text,
          'other'::text
        ]
      )
    ),

  constraint conversations_initiation_reason_required_check
    check (
      conversation_type = 'listing_request'
      or initiation_reason_code is not null
    ),

  constraint conversations_initiation_reason_details_check
    check (
      initiation_reason_details is null
      or char_length(btrim(initiation_reason_details)) <= 1000
    ),

  constraint conversations_status_check
    check (
      status = any (
        array[
          'open'::text,
          'closed'::text,
          'admin_locked'::text
        ]
      )
    ),

  constraint conversations_closed_reason_code_check
    check (
      closed_reason_code is null
      or closed_reason_code = any (
        array[
          'question_answered'::text,
          'not_moving_forward'::text,
          'not_a_fit'::text,
          'duplicate_conversation'::text,
          'unresponsive'::text,
          'unwanted_messages'::text,
          'other'::text
        ]
      )
    ),

  constraint conversations_closed_state_check
    check (
      (
        status = 'closed'
        and closed_at is not null
        and closed_by_user_id is not null
        and closed_reason_code is not null
      )
      or
      (
        status <> 'closed'
        and closed_at is null
        and closed_by_user_id is null
        and closed_reason_code is null
        and closed_reason_details is null
      )
    ),

  constraint conversations_closed_reason_details_check
    check (
      closed_reason_details is null
      or char_length(btrim(closed_reason_details)) <= 1000
    ),

  constraint conversations_admin_locked_state_check
    check (
      (
        status = 'admin_locked'
        and admin_locked_at is not null
        and admin_locked_by_user_id is not null
      )
      or
      (
        status <> 'admin_locked'
        and admin_locked_at is null
        and admin_locked_by_user_id is null
      )
    ),

  constraint conversations_buyer_image_upload_status_check
    check (
      buyer_image_upload_status = any (
        array[
          'blocked'::text,
          'requested'::text,
          'approved'::text,
          'revoked'::text
        ]
      )
    ),

  constraint conversations_buyer_image_upload_request_note_check
    check (
      buyer_image_upload_request_note is null
      or char_length(btrim(buyer_image_upload_request_note)) <= 1000
    ),

  constraint conversations_last_message_preview_check
    check (
      last_message_preview is null
      or char_length(last_message_preview) <= 180
    )
);

create index if not exists conversations_buyer_status_updated_at_idx
  on public.conversations using btree (
    buyer_user_id,
    status,
    updated_at desc
  );

create index if not exists conversations_creator_status_updated_at_idx
  on public.conversations using btree (
    creator_user_id,
    status,
    updated_at desc
  );

create index if not exists conversations_listing_id_idx
  on public.conversations using btree (listing_id);

create index if not exists conversations_listing_request_id_idx
  on public.conversations using btree (listing_request_id);

create index if not exists conversations_last_message_at_idx
  on public.conversations using btree (last_message_at desc);

create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function set_updated_at();


create table public.conversation_participants (
  conversation_id uuid not null,
  user_id uuid not null,
  role text not null,

  last_read_at timestamp with time zone null,
  archived_at timestamp with time zone null,
  muted_at timestamp with time zone null,

  created_at timestamp with time zone not null default now(),

  constraint conversation_participants_pkey
    primary key (conversation_id, user_id),

  constraint conversation_participants_conversation_id_fkey
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,

  constraint conversation_participants_user_id_fkey
    foreign key (user_id) references auth.users (id),

  constraint conversation_participants_role_check
    check (
      role = any (
        array[
          'buyer'::text,
          'creator'::text
        ]
      )
    )
);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants using btree (user_id);

create index if not exists conversation_participants_conversation_id_idx
  on public.conversation_participants using btree (conversation_id);


create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = p_conversation_id
      and conversation_participants.user_id = p_user_id
  );
$$;

grant execute on function public.is_conversation_participant(uuid, uuid)
to authenticated;


create table public.conversation_messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  sender_user_id uuid not null,

  message_type text not null default 'text',
  body text null,

  created_at timestamp with time zone not null default now(),

  constraint conversation_messages_pkey primary key (id),

  constraint conversation_messages_id_conversation_id_key
    unique (id, conversation_id),

  constraint conversation_messages_conversation_id_fkey
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,

  constraint conversation_messages_sender_user_id_fkey
    foreign key (sender_user_id) references auth.users (id),

  constraint conversation_messages_type_check
    check (
      message_type = any (
        array[
          'text'::text,
          'system'::text,
          'attachment'::text,
          'mixed'::text
        ]
      )
    ),

  constraint conversation_messages_body_check
    check (
      (
        message_type = any (array['text'::text, 'system'::text])
        and body is not null
        and char_length(btrim(body)) >= 1
        and char_length(btrim(body)) <= 2000
      )
      or
      (
        message_type = any (array['attachment'::text, 'mixed'::text])
        and (
          body is null
          or char_length(btrim(body)) <= 2000
        )
      )
    )
);

create index if not exists conversation_messages_conversation_created_at_idx
  on public.conversation_messages using btree (
    conversation_id,
    created_at asc
  );

create index if not exists conversation_messages_sender_user_id_idx
  on public.conversation_messages using btree (sender_user_id);


create table public.conversation_message_attachments (
  id uuid not null default gen_random_uuid(),

  message_id uuid not null,
  conversation_id uuid not null,
  uploaded_by_user_id uuid not null,

  attachment_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  width integer null,
  height integer null,

  created_at timestamp with time zone not null default now(),

  constraint conversation_message_attachments_pkey primary key (id),

  constraint conversation_message_attachments_message_conversation_fkey
    foreign key (message_id, conversation_id)
    references public.conversation_messages (id, conversation_id)
    on delete cascade,

  constraint conversation_message_attachments_conversation_id_fkey
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,

  constraint conversation_message_attachments_uploaded_by_user_id_fkey
    foreign key (uploaded_by_user_id) references auth.users (id),

  constraint conversation_message_attachments_type_check
    check (
      attachment_type = any (
        array[
          'image'::text
        ]
      )
    ),

  constraint conversation_message_attachments_image_mime_check
    check (
      attachment_type <> 'image'
      or mime_type like 'image/%'
    ),

  constraint conversation_message_attachments_file_size_check
    check (file_size_bytes > 0)
);

create index if not exists conversation_message_attachments_message_id_idx
  on public.conversation_message_attachments using btree (message_id);

create index if not exists conversation_message_attachments_conversation_id_idx
  on public.conversation_message_attachments using btree (conversation_id);


create table public.conversation_reports (
  id uuid not null default gen_random_uuid(),

  conversation_id uuid not null,
  message_id uuid null,

  reporter_user_id uuid not null,
  reported_user_id uuid null,

  reason_code text not null,
  reason_details text null,

  status text not null default 'submitted',

  created_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone null,
  reviewed_by_user_id uuid null,
  admin_notes text null,

  constraint conversation_reports_pkey primary key (id),

  constraint conversation_reports_conversation_id_fkey
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,

  constraint conversation_reports_message_id_fkey
    foreign key (message_id)
    references public.conversation_messages (id)
    on delete set null,

  constraint conversation_reports_reporter_user_id_fkey
    foreign key (reporter_user_id) references auth.users (id),

  constraint conversation_reports_reported_user_id_fkey
    foreign key (reported_user_id) references auth.users (id),

  constraint conversation_reports_reviewed_by_user_id_fkey
    foreign key (reviewed_by_user_id) references auth.users (id),

  constraint conversation_reports_status_check
    check (
      status = any (
        array[
          'submitted'::text,
          'reviewing'::text,
          'resolved'::text,
          'dismissed'::text
        ]
      )
    ),

  constraint conversation_reports_reason_code_check
    check (
      reason_code = any (
        array[
          'spam'::text,
          'harassment'::text,
          'scam_or_suspicious'::text,
          'inappropriate_content'::text,
          'unsolicited_images'::text,
          'off_platform_payment'::text,
          'other'::text
        ]
      )
    ),

  constraint conversation_reports_reason_details_check
    check (
      reason_details is null
      or char_length(btrim(reason_details)) <= 1000
    ),

  constraint conversation_reports_admin_notes_check
    check (
      admin_notes is null
      or char_length(btrim(admin_notes)) <= 2000
    )
);

create index if not exists conversation_reports_conversation_id_idx
  on public.conversation_reports using btree (conversation_id);

create index if not exists conversation_reports_message_id_idx
  on public.conversation_reports using btree (message_id);

create index if not exists conversation_reports_status_created_at_idx
  on public.conversation_reports using btree (status, created_at desc);


create table public.conversation_events (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  actor_user_id uuid null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),

  constraint conversation_events_pkey primary key (id),

  constraint conversation_events_conversation_id_fkey
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,

  constraint conversation_events_actor_user_id_fkey
    foreign key (actor_user_id) references auth.users (id),

  constraint conversation_events_type_check
    check (
      event_type = any (
        array[
          'conversation_created'::text,
          'message_sent'::text,
          'conversation_closed'::text,
          'conversation_reported'::text,
          'buyer_image_upload_requested'::text,
          'buyer_image_upload_approved'::text,
          'buyer_image_upload_revoked'::text,
          'admin_locked'::text,
          'admin_unlocked'::text,
          'request_linked'::text
        ]
      )
    )
);

create index if not exists conversation_events_conversation_created_at_idx
  on public.conversation_events using btree (
    conversation_id,
    created_at asc
  );