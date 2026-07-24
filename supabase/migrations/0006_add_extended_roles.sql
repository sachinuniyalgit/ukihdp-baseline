-- PostgreSQL requires newly added enum values to be committed before another
-- migration can safely use them in policies, functions, defaults, or casts.

alter type public.app_role add value if not exists 'researcher';
alter type public.app_role add value if not exists 'supervisor';
