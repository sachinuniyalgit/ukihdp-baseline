-- FieldFlow multi-study expansion. This migration is additive and preserves all
-- existing questionnaires, submissions, payloads, review events, and identifiers.

alter table public.profiles
  add column if not exists profile_photo_url text,
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists primary_mobile text,
  add column if not exists alternate_mobile text,
  add column if not exists alternate_email text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text default 'India',
  add column if not exists organisation text,
  add column if not exists department text,
  add column if not exists designation text,
  add column if not exists staff_id text,
  add column if not exists username text,
  add column if not exists last_login timestamptz,
  add column if not exists last_active timestamptz,
  add column if not exists last_sync timestamptz;

create unique index if not exists profiles_username_unique_idx on public.profiles(lower(username)) where username is not null;
create index if not exists profiles_organisation_idx on public.profiles(organisation);

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  short_name text not null,
  description text,
  study_type text not null,
  organisation text not null,
  study_lead text,
  contact_person text,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  geographic_coverage jsonb not null default '[]'::jsonb,
  target_sample integer not null default 0 check (target_sample >= 0),
  treatment_target integer check (treatment_target is null or treatment_target >= 0),
  control_target integer check (control_target is null or control_target >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.studies (
  id, code, full_name, short_name, description, study_type, organisation,
  study_lead, contact_person, status, geographic_coverage, target_sample,
  treatment_target, control_target
) values (
  '00000000-0000-4000-8000-000000000001',
  'UKIHDP-BL',
  'Baseline Assessment of Farmer Livelihoods, Horticultural Production Systems and Value Chain Development in Uttarakhand Himalaya',
  'Uttarakhand Horticulture Baseline',
  'Existing household and FPO baseline assessment preserved as the first FieldFlow study.',
  'Baseline assessment',
  'UKIHDP',
  'Project Study Lead',
  'FieldFlow Administrator',
  'active',
  '["Nainital", "Pithoragarh", "Tehri Garhwal", "Uttarkashi"]'::jsonb,
  960, 640, 320
) on conflict (id) do update set
  full_name = excluded.full_name,
  short_name = excluded.short_name,
  description = excluded.description,
  target_sample = excluded.target_sample,
  treatment_target = excluded.treatment_target,
  control_target = excluded.control_target,
  updated_at = now();

alter table public.questionnaire_versions
  add column if not exists study_id uuid references public.studies(id),
  add column if not exists definition jsonb,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

update public.questionnaire_versions
set study_id = '00000000-0000-4000-8000-000000000001'
where study_id is null and code in ('ukihdp-household-baseline', 'ukihdp-fpo-institutional');

alter table public.survey_submissions
  add column if not exists study_id uuid references public.studies(id);

update public.survey_submissions
set study_id = '00000000-0000-4000-8000-000000000001'
where study_id is null;

create table if not exists public.study_assignments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  role_in_study text not null check (role_in_study in ('study_manager', 'supervisor', 'reviewer', 'enumerator')),
  district text,
  block text,
  fpo text,
  villages jsonb not null default '[]'::jsonb,
  sample_group text check (sample_group in ('treatment', 'control', 'both')),
  assignment_start_date date,
  assignment_end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, user_id, role_in_study, district, block, fpo)
);

insert into public.study_assignments (study_id, user_id, role_in_study, active)
select
  '00000000-0000-4000-8000-000000000001',
  p.id,
  case p.role::text
    when 'admin' then 'study_manager'
    when 'researcher' then 'study_manager'
    when 'supervisor' then 'supervisor'
    when 'reviewer' then 'reviewer'
    else 'enumerator'
  end,
  p.active
from public.profiles p
on conflict do nothing;

create table if not exists public.study_locations (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  location_type text not null check (location_type in ('study', 'project', 'concern')),
  name text not null,
  description text,
  district text,
  block text,
  village text,
  latitude double precision not null,
  longitude double precision not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questionnaire_imports (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  source_file_name text not null,
  source_format text not null check (source_format in ('xlsx', 'csv')),
  status text not null check (status in ('uploaded', 'validated', 'failed', 'published')),
  validation_errors jsonb not null default '[]'::jsonb,
  validation_warnings jsonb not null default '[]'::jsonb,
  parsed_definition jsonb,
  imported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists studies_status_idx on public.studies(status);
create index if not exists study_assignments_user_idx on public.study_assignments(user_id, active);
create index if not exists study_assignments_study_idx on public.study_assignments(study_id, active);
create index if not exists study_locations_study_idx on public.study_locations(study_id, location_type);
create index if not exists survey_submissions_study_idx on public.survey_submissions(study_id, status);
create index if not exists questionnaire_versions_study_idx on public.questionnaire_versions(study_id, status);

alter table public.studies enable row level security;
alter table public.study_assignments enable row level security;
alter table public.study_locations enable row level security;
alter table public.questionnaire_imports enable row level security;

create or replace function public.can_access_study(target_study_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    public.current_app_role()::text = 'admin'
    or exists (select 1 from public.studies s where s.id = target_study_id and s.created_by = auth.uid())
    or exists (
      select 1 from public.study_assignments a
      where a.study_id = target_study_id and a.user_id = auth.uid() and a.active = true
        and (a.assignment_start_date is null or a.assignment_start_date <= current_date)
        and (a.assignment_end_date is null or a.assignment_end_date >= current_date)
    );
$$;

create policy "users read assigned studies" on public.studies for select to authenticated
  using (public.can_access_study(id));
create policy "admins and researchers create studies" on public.studies for insert to authenticated
  with check (public.current_app_role()::text in ('admin', 'researcher') and (created_by = auth.uid() or public.current_app_role()::text = 'admin'));
create policy "admins and researchers update studies" on public.studies for update to authenticated
  using (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(id))
  with check (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(id));

create policy "users read own or managed assignments" on public.study_assignments for select to authenticated
  using (user_id = auth.uid() or (public.current_app_role()::text in ('admin', 'researcher', 'supervisor') and public.can_access_study(study_id)));
create policy "study managers manage assignments" on public.study_assignments for all to authenticated
  using (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(study_id))
  with check (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(study_id));

create policy "users read assigned study locations" on public.study_locations for select to authenticated
  using (public.can_access_study(study_id));
create policy "study managers manage locations" on public.study_locations for all to authenticated
  using (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(study_id))
  with check (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(study_id));

create policy "study managers read questionnaire imports" on public.questionnaire_imports for select to authenticated
  using (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(study_id));
create policy "study managers create questionnaire imports" on public.questionnaire_imports for insert to authenticated
  with check (public.current_app_role()::text in ('admin', 'researcher') and public.can_access_study(study_id));

drop policy if exists "profiles read own or management" on public.profiles;
create policy "profiles read own or management" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_app_role()::text in ('admin', 'researcher', 'supervisor', 'reviewer'));

create or replace function public.can_access_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.survey_submissions s
    where s.id = target_submission_id
      and (
        s.enumerator_id = auth.uid()
        or public.current_app_role()::text = 'admin'
        or (public.current_app_role()::text in ('researcher', 'supervisor', 'reviewer') and public.can_access_study(s.study_id))
      )
  );
$$;

drop policy if exists "users read permitted submissions" on public.survey_submissions;
create policy "users read permitted submissions" on public.survey_submissions for select to authenticated
  using (public.can_access_submission(id));

drop policy if exists "management reviews submissions" on public.survey_submissions;
create policy "study management reviews submissions" on public.survey_submissions for update to authenticated
  using (public.current_app_role()::text in ('admin', 'researcher', 'supervisor', 'reviewer') and public.can_access_study(study_id))
  with check (public.current_app_role()::text in ('admin', 'researcher', 'supervisor', 'reviewer') and public.can_access_study(study_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first_profile boolean;
  requested public.app_role;
begin
  select not exists (select 1 from public.profiles) into is_first_profile;
  requested := case new.raw_user_meta_data ->> 'requested_role'
    when 'admin' then 'admin'::public.app_role
    when 'researcher' then 'researcher'::public.app_role
    when 'supervisor' then 'supervisor'::public.app_role
    when 'reviewer' then 'reviewer'::public.app_role
    else 'enumerator'::public.app_role
  end;
  insert into public.profiles (id, display_name, email, username, role, requested_role, active, last_login, last_active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    split_part(new.email, '@', 1),
    'enumerator',
    requested,
    is_first_profile,
    now(),
    now()
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

comment on table public.studies is 'Reusable FieldFlow studies. The existing UKIHDP baseline is preserved as the first study.';
comment on column public.questionnaire_versions.definition is 'Immutable versioned questionnaire definition used by the configurable renderer.';
