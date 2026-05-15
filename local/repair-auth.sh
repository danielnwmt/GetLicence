#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "❌ Execute como root: sudo bash local/repair-auth.sh"
  exit 1
fi

NO_RESTART=false
if [[ "${1:-}" == "--no-restart" ]]; then
  NO_RESTART=true
fi

AUTH_ENV="${AUTH_ENV:-/etc/getlicence-auth.env}"
if [[ ! -f "$AUTH_ENV" ]]; then
  echo "❌ Arquivo não encontrado: $AUTH_ENV"
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$AUTH_ENV" | tail -n1 | cut -d= -f2-)
if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ DATABASE_URL não encontrado em $AUTH_ENV"
  exit 1
fi

read -r DB_NAME PG_PASS < <(DATABASE_URL="$DATABASE_URL" python3 - <<'PY'
import os
from urllib.parse import urlparse, unquote

url = urlparse(os.environ["DATABASE_URL"])
print((url.path or "/getlicence").lstrip("/") or "getlicence", unquote(url.password or ""))
PY
)

if [[ -z "$DB_NAME" || -z "$PG_PASS" ]]; then
  echo "❌ Não foi possível ler banco/senha do DATABASE_URL"
  exit 1
fi

echo "▶ Reparando autenticação local no banco $DB_NAME"
sudo -u postgres psql -v ON_ERROR_STOP=1 -v dbname="$DB_NAME" -v pgpass="$PG_PASS" -d "$DB_NAME" <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER ROLE supabase_auth_admin LOGIN;
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER ROLE supabase_auth_admin SET search_path = auth, public;

ALTER ROLE authenticator LOGIN;
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER ROLE authenticator SET search_path = public;

GRANT CONNECT ON DATABASE :"dbname" TO supabase_auth_admin, authenticator, anon, authenticated, service_role;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA auth TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS obj FROM pg_tables WHERE schemaname = 'auth' LOOP
    EXECUTE 'ALTER TABLE ' || item.obj || ' OWNER TO supabase_auth_admin';
  END LOOP;

  FOR item IN SELECT quote_ident(sequence_schema) || '.' || quote_ident(sequence_name) AS obj FROM information_schema.sequences WHERE sequence_schema = 'auth' LOOP
    EXECUTE 'ALTER SEQUENCE ' || item.obj || ' OWNER TO supabase_auth_admin';
  END LOOP;

  FOR item IN
    SELECT oid::regprocedure::text AS obj
    FROM pg_proc
    WHERE pronamespace = 'auth'::regnamespace
  LOOP
    EXECUTE 'ALTER FUNCTION ' || item.obj || ' OWNER TO supabase_auth_admin';
  END LOOP;
END $$;
SQL

if [[ "$NO_RESTART" == false ]]; then
  systemctl restart getlicence-auth getlicence-postgrest || true
fi

echo "✓ Autenticação local reparada"