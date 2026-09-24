-- Reproduce localmente lo que Supabase provee de fábrica, para poder probar
-- el esquema y las políticas RLS contra un Postgres pelado.
--   · auth.users        tabla de cuentas
--   · auth.uid()        lee el "sub" del JWT; acá lo simulamos con una variable
--   · roles anon / authenticated / service_role

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- PostgREST expone los claims como JSON en request.jwt.claims; las versiones
-- viejas usaban request.jwt.claim.<nombre>. Aceptamos las dos formas.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')
  )::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated, service_role;
