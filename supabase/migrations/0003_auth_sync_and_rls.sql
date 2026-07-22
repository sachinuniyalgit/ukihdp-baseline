alter table public.survey_submissions
  alter column client_generated_id type text using client_generated_id::text;

alter table public.survey_submissions
  add column review_note text;

create table public.survey_submission_payloads (
  submission_id uuid primary key references public.survey_submissions(id) on delete cascade,
  questionnaire_code text not null,
  questionnaire_version text not null,
  answers jsonb not null default '{}'::jsonb,
  source_device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.survey_submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  from_status public.survey_status not null,
  to_status public.survey_status not null,
  comment text,
  created_at timestamptz not null default now()
);

insert into public.questionnaire_versions (code, version, title, status) values
  ('ukihdp-household-baseline', '1.1-draft', 'UKIHDP Household Baseline Survey', 'published'),
  ('ukihdp-fpo-institutional', '1.0-draft', 'UKIHDP FPO Institutional Assessment', 'published')
on conflict (code, version) do update set title = excluded.title, status = excluded.status;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, active)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'enumerator', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.can_access_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.survey_submissions s
    where s.id = target_submission_id
      and (s.enumerator_id = auth.uid() or public.current_app_role() in ('admin', 'reviewer'))
  );
$$;

alter table public.survey_submission_payloads enable row level security;
alter table public.review_events enable row level security;

create policy "profiles read own or management" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_app_role() in ('admin', 'reviewer'));
create policy "admins manage profiles" on public.profiles for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "authenticated read questionnaire versions" on public.questionnaire_versions for select to authenticated using (true);
create policy "authenticated read questionnaire sections" on public.questionnaire_sections for select to authenticated using (true);
create policy "authenticated read questionnaire questions" on public.questionnaire_questions for select to authenticated using (true);
create policy "admins manage questionnaire versions" on public.questionnaire_versions for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "admins manage questionnaire sections" on public.questionnaire_sections for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "admins manage questionnaire questions" on public.questionnaire_questions for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "users read permitted submissions" on public.survey_submissions for select to authenticated
  using (enumerator_id = auth.uid() or public.current_app_role() in ('admin', 'reviewer'));
create policy "enumerators create own submissions" on public.survey_submissions for insert to authenticated
  with check (enumerator_id = auth.uid() and status in ('draft', 'queued', 'submitted'));
create policy "enumerators update returned work" on public.survey_submissions for update to authenticated
  using (enumerator_id = auth.uid() and status in ('draft', 'queued', 'returned'))
  with check (enumerator_id = auth.uid() and status in ('draft', 'queued', 'submitted'));
create policy "management reviews submissions" on public.survey_submissions for update to authenticated
  using (public.current_app_role() in ('admin', 'reviewer'))
  with check (public.current_app_role() in ('admin', 'reviewer'));

create policy "users read permitted payloads" on public.survey_submission_payloads for select to authenticated
  using (public.can_access_submission(submission_id));
create policy "enumerators insert own payloads" on public.survey_submission_payloads for insert to authenticated
  with check (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid()));
create policy "enumerators update own payloads" on public.survey_submission_payloads for update to authenticated
  using (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid() and s.status in ('draft', 'queued', 'returned')))
  with check (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid()));

create policy "users read permitted responses" on public.survey_responses for select to authenticated using (public.can_access_submission(submission_id));
create policy "enumerators manage own responses" on public.survey_responses for all to authenticated
  using (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid() and s.status in ('draft', 'queued', 'returned')))
  with check (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid()));

create policy "users read permitted sync events" on public.sync_events for select to authenticated using (public.can_access_submission(submission_id));
create policy "enumerators create own sync events" on public.sync_events for insert to authenticated
  with check (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid()));

create policy "users read related reviews" on public.review_events for select to authenticated using (public.can_access_submission(submission_id));
create policy "management creates reviews" on public.review_events for insert to authenticated
  with check (reviewer_id = auth.uid() and public.current_app_role() in ('admin', 'reviewer'));

create policy "authenticated read project settings" on public.project_settings for select to authenticated using (true);
create policy "authenticated read crop master" on public.crop_master for select to authenticated using (true);
create policy "authenticated read crop varieties" on public.crop_variety_master for select to authenticated using (true);
create policy "authenticated read FPO mappings" on public.fpo_focus_crop_mappings for select to authenticated using (true);
create policy "admins manage project settings" on public.project_settings for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "admins manage crop master" on public.crop_master for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "admins manage crop varieties" on public.crop_variety_master for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "admins manage FPO mappings" on public.fpo_focus_crop_mappings for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "users read permitted focus crops" on public.survey_focus_crops for select to authenticated using (public.can_access_submission(submission_id));
create policy "enumerators manage own focus crops" on public.survey_focus_crops for all to authenticated
  using (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid() and s.status in ('draft', 'queued', 'returned')))
  with check (exists (select 1 from public.survey_submissions s where s.id = submission_id and s.enumerator_id = auth.uid()));
create policy "users read permitted crop cycles" on public.survey_crop_cycles for select to authenticated
  using (exists (select 1 from public.survey_focus_crops f where f.focus_crop_id = survey_crop_cycles.focus_crop_id and public.can_access_submission(f.submission_id)));
create policy "users read permitted linked sections" on public.focus_crop_section_responses for select to authenticated
  using (exists (select 1 from public.survey_focus_crops f where f.focus_crop_id = focus_crop_section_responses.focus_crop_id and public.can_access_submission(f.submission_id)));

create policy "admins read audit log" on public.master_data_audit_log for select to authenticated using (public.current_app_role() = 'admin');
create policy "admins create audit log" on public.master_data_audit_log for insert to authenticated with check (public.current_app_role() = 'admin' and changed_by = auth.uid());

create index survey_payload_updated_idx on public.survey_submission_payloads(updated_at);
create index review_events_submission_idx on public.review_events(submission_id, created_at);

-- After the first Auth user is created, promote the authorized project owner once:
-- update public.profiles set role = 'admin' where id = '<approved-user-uuid>';
