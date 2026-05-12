-- Cria roles compatíveis com Supabase (anon, authenticated, service_role)
-- e o schema auth usado pelo GoTrue. As senhas são definidas pelo install.sh.

-- Roles
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

create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
alter default privileges in schema auth grant all on tables to supabase_auth_admin;
alter default privileges in schema auth grant all on sequences to supabase_auth_admin;
alter default privileges in schema auth grant all on functions to supabase_auth_admin;

-- Helpers auth.uid() / auth.role() / auth.jwt() como o Supabase fornece
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb) $$;

create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text language sql stable as
$$ select current_setting('request.jwt.claim.role', true) $$;

create or replace function auth.email() returns text language sql stable as
$$ select current_setting('request.jwt.claim.email', true) $$;
