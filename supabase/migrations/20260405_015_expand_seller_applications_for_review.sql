alter table public.seller_applications
  add column if not exists applicant_notes text null,
  add column if not exists review_notes text null,
  add column if not exists submitted_at timestamptz null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by uuid null,
  add column if not exists agreed_to_terms boolean not null default false,
  add column if not exists agreed_to_original_work boolean not null default false,
  add column if not exists agreed_to_manual_review boolean not null default false;