-- Roles + schema auth limpo. NÃO cria funções auth.*, isso é feito após
-- o GoTrue migrar (no 02_app_schema.sql) para evitar conflitos de ownership.

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
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login createrole;
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;

-- Recria schema auth do zero para garantir ownership correto a cada install.
drop schema if exists auth cascade;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
alter default privileges in schema auth grant all on tables to supabase_auth_admin;
alter default privileges in schema auth grant all on sequences to supabase_auth_admin;
alter default privileges in schema auth grant all on functions to supabase_auth_admin;
