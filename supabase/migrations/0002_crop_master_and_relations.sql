create table public.project_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  confirmation_status text not null default 'pending_confirmation'
    check (confirmation_status in ('confirmed', 'pending_confirmation')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.crop_master (
  id text primary key,
  crop_name text not null unique,
  category text not null,
  crop_type text not null check (crop_type in ('annual_seasonal', 'perennial_orchard', 'other')),
  confirmation_status text not null default 'pending_confirmation'
    check (confirmation_status in ('confirmed', 'pending_confirmation')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crop_variety_master (
  id uuid primary key default gen_random_uuid(),
  crop_id text not null references public.crop_master(id),
  variety_name text not null,
  variety_type text not null default 'unknown',
  approved boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crop_id, variety_name)
);

create table public.fpo_focus_crop_mappings (
  id uuid primary key default gen_random_uuid(),
  fpo_name text not null,
  crop_id text not null references public.crop_master(id),
  confirmation_status text not null default 'pending_confirmation'
    check (confirmation_status in ('confirmed', 'pending_confirmation')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fpo_name, crop_id)
);

create table public.survey_focus_crops (
  focus_crop_id text primary key,
  submission_id uuid not null references public.survey_submissions(id) on delete cascade,
  crop_id text not null references public.crop_master(id),
  crop_name_at_collection text not null,
  crop_type_at_collection text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, crop_id)
);

create table public.survey_crop_cycles (
  crop_cycle_id text primary key,
  focus_crop_id text not null references public.survey_focus_crops(focus_crop_id) on delete cascade,
  cycle_number integer not null check (cycle_number > 0),
  season text,
  production_data jsonb not null default '{}'::jsonb,
  practice_data jsonb not null default '{}'::jsonb,
  cost_data jsonb not null default '{}'::jsonb,
  constraint_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (focus_crop_id, cycle_number)
);

create table public.focus_crop_section_responses (
  id uuid primary key default gen_random_uuid(),
  focus_crop_id text not null references public.survey_focus_crops(focus_crop_id) on delete cascade,
  section_code text not null check (section_code in ('inputs_extension', 'processing', 'marketing')),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (focus_crop_id, section_code)
);

create table public.master_data_audit_log (
  id uuid primary key default gen_random_uuid(),
  configuration_area text not null,
  previous_value jsonb,
  new_value jsonb not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

insert into public.project_settings (setting_key, setting_value, confirmation_status) values
  ('youth_age_definition', '{"minimumAge": null, "maximumAge": null}'::jsonb, 'pending_confirmation'),
  ('nali_unit_conversion', '{"naliToAcre": null, "naliToHectare": null}'::jsonb, 'pending_confirmation');

insert into public.crop_master (id, crop_name, category, crop_type, confirmation_status) values
  ('crop-apple', 'Apple', 'Fruit', 'perennial_orchard', 'confirmed'),
  ('crop-peach', 'Peach', 'Fruit', 'perennial_orchard', 'confirmed'),
  ('crop-kiwi', 'Kiwi', 'Fruit', 'perennial_orchard', 'confirmed'),
  ('crop-walnut', 'Walnut', 'Fruit', 'perennial_orchard', 'confirmed'),
  ('crop-citrus', 'Citrus', 'Fruit', 'perennial_orchard', 'confirmed'),
  ('crop-litchi', 'Litchi', 'Fruit', 'perennial_orchard', 'confirmed'),
  ('crop-potato', 'Potato', 'Vegetable', 'annual_seasonal', 'confirmed'),
  ('crop-tomato', 'Tomato', 'Vegetable', 'annual_seasonal', 'confirmed'),
  ('crop-pea', 'Pea', 'Vegetable', 'annual_seasonal', 'confirmed'),
  ('crop-garlic', 'Garlic', 'Spice', 'annual_seasonal', 'confirmed'),
  ('crop-ginger', 'Ginger', 'Spice', 'annual_seasonal', 'confirmed');

insert into public.fpo_focus_crop_mappings (fpo_name, crop_id, confirmation_status) values
  ('Ratandeep Farmer Producer Company Limited', 'crop-peach', 'confirmed'),
  ('Ramnagar Bhawar Krishak Utpadan Sangathan Swayatt Sahkarita', 'crop-litchi', 'confirmed'),
  ('Himalaya FPO', 'crop-tomato', 'confirmed'),
  ('GuruGorakhnath FPO', 'crop-garlic', 'confirmed'),
  ('Chhipla Kedar FPO', 'crop-apple', 'confirmed'),
  ('Chhipla Kedar FPO', 'crop-potato', 'confirmed'),
  ('Himshikhar Farmers Producer Company Limited', 'crop-citrus', 'confirmed'),
  ('Monal Farmers Producer Company Limited', 'crop-ginger', 'confirmed'),
  ('Basukinag FPO', 'crop-garlic', 'confirmed'),
  ('Basukinag FPO', 'crop-kiwi', 'confirmed'),
  ('Sewa Saksham Farmer Producer Company Limited', 'crop-apple', 'confirmed'),
  ('Laloor Patti Fed Farmer Producer Company Limited', 'crop-pea', 'confirmed'),
  ('Sewa Lakshay Farmer Producer Company Limited', 'crop-potato', 'confirmed'),
  ('Sewa Koshish Kisan Utpadak Swayatt Sahakarita', 'crop-ginger', 'confirmed'),
  ('Veerangana Krishak Utpadak Sangathan FPO', 'crop-apple', 'confirmed'),
  ('Yamunotri Fed Farmer Producer Company Limited', 'crop-walnut', 'confirmed'),
  ('Yamunotri Fed Farmer Producer Company Limited', 'crop-tomato', 'confirmed'),
  ('Upla Taknor Krishak Utpadak Sangathan Swayatt Sahkarita', 'crop-potato', 'confirmed'),
  ('Gangotri Fed FPCL', 'crop-kiwi', 'confirmed');

create index crop_variety_crop_idx on public.crop_variety_master(crop_id);
create index fpo_focus_mapping_fpo_idx on public.fpo_focus_crop_mappings(fpo_name);
create index survey_focus_crop_submission_idx on public.survey_focus_crops(submission_id);
create index survey_crop_cycle_focus_idx on public.survey_crop_cycles(focus_crop_id);

alter table public.project_settings enable row level security;
alter table public.crop_master enable row level security;
alter table public.crop_variety_master enable row level security;
alter table public.fpo_focus_crop_mappings enable row level security;
alter table public.survey_focus_crops enable row level security;
alter table public.survey_crop_cycles enable row level security;
alter table public.focus_crop_section_responses enable row level security;
alter table public.master_data_audit_log enable row level security;

-- RLS remains closed until the connected Supabase project receives the approved
-- Admin/Reviewer/Enumerator policies and project-assignment rules.
