create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'reviewer', 'enumerator');
create type public.survey_status as enum (
  'draft', 'queued', 'submitted', 'under_review', 'returned', 'approved'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'enumerator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table public.questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  questionnaire_version_id uuid not null references public.questionnaire_versions(id) on delete cascade,
  section_code text not null,
  title text not null,
  instrument text not null check (instrument in ('household', 'institutional')),
  display_order integer not null,
  configuration jsonb not null default '{}'::jsonb,
  unique (questionnaire_version_id, section_code)
);

create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.questionnaire_sections(id) on delete cascade,
  question_code text not null,
  label text not null,
  input_type text not null,
  required boolean not null default false,
  display_order integer not null,
  configuration jsonb not null default '{}'::jsonb,
  unique (section_id, question_code)
);

create table public.survey_submissions (
  id uuid primary key default gen_random_uuid(),
  client_generated_id uuid not null unique,
  questionnaire_version_id uuid not null references public.questionnaire_versions(id),
  enumerator_id uuid not null references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  status public.survey_status not null default 'draft',
  study_group text check (study_group in ('treatment', 'control')),
  district text,
  block text,
  fpo_cluster text,
  village text,
  latitude double precision,
  longitude double precision,
  gps_accuracy_meters double precision,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.survey_submissions(id) on delete cascade,
  question_id uuid not null references public.questionnaire_questions(id),
  repeat_instance text not null default '',
  answer jsonb not null,
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id, repeat_instance)
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.survey_submissions(id) on delete cascade,
  device_id text not null,
  client_revision integer not null,
  server_revision integer not null,
  result text not null check (result in ('accepted', 'conflict', 'rejected')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index survey_submissions_status_idx on public.survey_submissions(status);
create index survey_submissions_location_idx on public.survey_submissions(district, fpo_cluster, village);
create index survey_submissions_enumerator_idx on public.survey_submissions(enumerator_id);
create index survey_responses_submission_idx on public.survey_responses(submission_id);

alter table public.profiles enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.questionnaire_sections enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.survey_submissions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.sync_events enable row level security;

-- Production policies will be added after the Supabase project is connected
-- and the approved assignment rules are confirmed. RLS stays enabled by default.
