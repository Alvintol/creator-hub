-- Creator application sample submissions
-- Rules enforced primarily in app logic:
-- - min 3 samples to submit
-- - max 10 samples total
-- - max 1 video sample
-- - max 50 MB per uploaded file

create table if not exists public.seller_application_samples (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.seller_applications(id) on delete cascade,

  sample_type text not null check (sample_type in ('link', 'image', 'video')),
  title text not null,
  description text null,

  url text null,
  storage_path text null,
  file_name text null,
  mime_type text null,
  file_size_bytes bigint null,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Links must have a URL
  constraint seller_application_samples_link_requires_url
    check (
      sample_type <> 'link'
      or (url is not null and btrim(url) <> '')
    ),

  -- Uploaded image/video samples must have file metadata
  constraint seller_application_samples_upload_requires_storage
    check (
      sample_type = 'link'
      or (
        storage_path is not null and btrim(storage_path) <> ''
        and file_name is not null and btrim(file_name) <> ''
        and mime_type is not null and btrim(mime_type) <> ''
        and file_size_bytes is not null
      )
    ),

  -- 50 MB per uploaded file
  constraint seller_application_samples_file_size_limit
    check (
      file_size_bytes is null
      or file_size_bytes <= 52428800
    )
);

create index if not exists seller_application_samples_application_id_idx
  on public.seller_application_samples(application_id);

create index if not exists seller_application_samples_application_sort_idx
  on public.seller_application_samples(application_id, sort_order);

create index if not exists seller_application_samples_type_idx
  on public.seller_application_samples(sample_type);