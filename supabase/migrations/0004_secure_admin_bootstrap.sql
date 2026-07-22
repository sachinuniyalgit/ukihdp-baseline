create or replace function public.needs_initial_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where role = 'admin' and active = true
  );
$$;

revoke all on function public.needs_initial_admin() from public;
grant execute on function public.needs_initial_admin() to anon, authenticated;

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
  set role = 'admin', active = true, updated_at = now()
  where id = auth.uid();
  if not found then
    raise exception 'The authenticated profile was not found';
  end if;
  return 'admin'::public.app_role;
end;
$$;

revoke all on function public.claim_initial_admin() from public;
grant execute on function public.claim_initial_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first_profile boolean;
begin
  select not exists (select 1 from public.profiles) into is_first_profile;
  insert into public.profiles (id, display_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'enumerator',
    is_first_profile
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
