alter table public.profiles
  add column if not exists email text,
  add column if not exists requested_role public.app_role;

update public.profiles p
set email = u.email,
    requested_role = coalesce(p.requested_role, p.role)
from auth.users u
where u.id = p.id;

create index if not exists profiles_active_role_idx on public.profiles(active, requested_role);

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
    when 'reviewer' then 'reviewer'::public.app_role
    else 'enumerator'::public.app_role
  end;

  insert into public.profiles (id, display_name, email, role, requested_role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'enumerator',
    requested,
    is_first_profile
  )
  on conflict (id) do update
    set email = excluded.email,
        requested_role = coalesce(public.profiles.requested_role, excluded.requested_role),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.claim_initial_admin()
returns public.app_role
language plpgsql
security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ukihdp-initial-admin', 0));
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if exists (select 1 from public.profiles where role = 'admin' and active = true) then
    raise exception 'The initial Administrator has already been assigned';
  end if;
  update public.profiles
  set role = 'admin', requested_role = 'admin', active = true, updated_at = now()
  where id = auth.uid();
  if not found then
    raise exception 'The authenticated profile was not found';
  end if;
  return 'admin'::public.app_role;
end;
$$;

comment on column public.profiles.requested_role is
  'Role requested during self-registration. Only an active Administrator can approve it by updating role and active.';
