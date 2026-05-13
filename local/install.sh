#!/usr/bin/env bash
# Instalador GetLicence bare-metal para Ubuntu 22.04 / 24.04
# Sem Docker. Postgres + PostgREST + GoTrue + Nginx instalados nativamente.
#
# Uso:
#   sudo bash install.sh                                 # IP público, HTTP
#   sudo APP_DOMAIN=app.exemplo.com bash install.sh      # com SSL Let's Encrypt
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "❌ Execute como root: sudo bash install.sh"; exit 1; fi

APP_DIR="/opt/getlicence"
APP_USER="getlicence"
DB_NAME="getlicence"
PG_VERSION="16"
NODE_MAJOR="22"
POSTGREST_VERSION="v12.2.3"
GOTRUE_VERSION="v2.158.1"
STORAGE_VERSION="v1.11.13"
APP_DOMAIN="${APP_DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-admin@${APP_DOMAIN:-localhost}}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SRC_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
AUTH_MIGRATIONS_DIR="/usr/local/share/getlicence/auth-migrations"
STORAGE_DIR="/opt/getlicence-storage"
STORAGE_DATA_DIR="/var/lib/getlicence-storage"

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

if [[ -n "$APP_DOMAIN" ]]; then
  SITE_URL="https://${APP_DOMAIN}"
else
  IPADDR=$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null \
        || curl -s --max-time 4 https://ifconfig.me 2>/dev/null \
        || hostname -I 2>/dev/null | awk '{print $1}' || echo localhost)
  SITE_URL="http://${IPADDR}"
fi

# ---------- 1. dependências base ----------
log "Instalando dependências do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl gnupg openssl jq tar xz-utils \
  postgresql postgresql-contrib nginx unzip rsync git >/dev/null

CURRENT_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
fi
if [[ "$CURRENT_NODE_MAJOR" -lt "$NODE_MAJOR" ]]; then
  log "Instalando Node.js ${NODE_MAJOR}"
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v bun >/dev/null 2>&1; then
  log "Instalando bun"
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash >/dev/null
  ln -sf /usr/local/bin/bun /usr/local/bin/bunx
fi
ok "Node $(node -v) / bun $(bun -v)"

# ---------- 2. usuário do app ----------
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /bin/bash "$APP_USER"

# ---------- 3. PostgreSQL ----------
log "Configurando PostgreSQL"
systemctl enable --now postgresql >/dev/null
PG_PASS=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)

sudo -u postgres psql -v ON_ERROR_STOP=1 -tc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb "$DB_NAME"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c \
  "ALTER USER postgres WITH PASSWORD '${PG_PASS}';" >/dev/null

log "Carregando schema base do banco"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" < "$SCRIPT_DIR/db/init/01_roles_and_auth.sql" >/dev/null

# senhas dos roles internos
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER USER supabase_auth_admin WITH PASSWORD '${PG_PASS}';
   ALTER USER supabase_storage_admin WITH PASSWORD '${PG_PASS}';
   ALTER USER authenticator WITH PASSWORD '${PG_PASS}';
   ALTER ROLE supabase_auth_admin SET search_path = auth, public;
   ALTER ROLE supabase_storage_admin SET search_path = storage, public;
   GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
   GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
   GRANT USAGE ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin;" >/dev/null
ok "Banco base pronto"

# ---------- 4. PostgREST ----------
if [[ ! -x /usr/local/bin/postgrest ]]; then
  log "Baixando PostgREST ${POSTGREST_VERSION}"
  ARCH=$(uname -m); [[ "$ARCH" == "x86_64" ]] && ARCH="linux-static-x64" || ARCH="ubuntu-aarch64"
  curl -sL "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-${ARCH}.tar.xz" \
    | tar -xJ -C /usr/local/bin/
  chmod +x /usr/local/bin/postgrest
fi

cat >/etc/getlicence-postgrest.conf <<EOF
db-uri = "postgres://authenticator:${PG_PASS}@127.0.0.1:5432/${DB_NAME}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-host = "127.0.0.1"
server-port = 3001
EOF
chmod 600 /etc/getlicence-postgrest.conf

cat >/etc/systemd/system/getlicence-postgrest.service <<EOF
[Unit]
Description=GetLicence PostgREST
After=postgresql.service
[Service]
ExecStart=/usr/local/bin/postgrest /etc/getlicence-postgrest.conf
Restart=always
User=${APP_USER}
[Install]
WantedBy=multi-user.target
EOF

# ---------- 5. GoTrue (auth) ----------
if [[ ! -x /usr/local/bin/gotrue || ! -d "$AUTH_MIGRATIONS_DIR" || -z "$(ls -A "$AUTH_MIGRATIONS_DIR" 2>/dev/null)" ]]; then
  log "Baixando GoTrue ${GOTRUE_VERSION}"
  ARCH=$(uname -m); [[ "$ARCH" == "x86_64" ]] && GARCH="x86" || GARCH="arm64"
  TMP=$(mktemp -d)
  curl -fsSL "https://github.com/supabase/auth/releases/download/${GOTRUE_VERSION}/auth-${GOTRUE_VERSION}-${GARCH}.tar.gz" \
    | tar -xz -C "$TMP"
  install -m 755 "$TMP"/auth /usr/local/bin/gotrue
  mkdir -p "$AUTH_MIGRATIONS_DIR"
  cp -a "$TMP"/migrations/. "$AUTH_MIGRATIONS_DIR"/
  rm -rf "$TMP"
fi

cat >/etc/getlicence-auth.env <<EOF
GOTRUE_API_HOST=127.0.0.1
PORT=9999
API_EXTERNAL_URL=${SITE_URL}/auth/v1
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:${PG_PASS}@127.0.0.1:5432/${DB_NAME}
DB_NAMESPACE=auth
GOTRUE_DB_MIGRATIONS_PATH=${AUTH_MIGRATIONS_DIR}
GOTRUE_SITE_URL=${SITE_URL}
GOTRUE_URI_ALLOW_LIST=${SITE_URL}
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMTP_ADMIN_EMAIL=admin@getlicence.com
GOTRUE_LOG_LEVEL=info
EOF
chmod 600 /etc/getlicence-auth.env

log "Migrando autenticação"
set -a
source /etc/getlicence-auth.env
set +a
/usr/local/bin/gotrue migrate >/dev/null

log "Carregando schema da aplicação"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" < "$SCRIPT_DIR/db/init/02_app_schema.sql" >/dev/null
ok "Banco ${DB_NAME} pronto"

cat >/etc/systemd/system/getlicence-auth.service <<EOF
[Unit]
Description=GetLicence Auth (GoTrue)
After=postgresql.service
[Service]
EnvironmentFile=/etc/getlicence-auth.env
ExecStart=/usr/local/bin/gotrue
Restart=always
User=${APP_USER}
[Install]
WantedBy=multi-user.target
EOF

# ---------- 6. gerar chaves anon / service_role ----------
b64(){ openssl base64 -A | tr -- '+/' '-_' | tr -d '='; }
mkjwt(){
  local role="$1"; local exp=$(( $(date +%s) + 60*60*24*365*10 ))
  local h p s
  h=$(printf '{"alg":"HS256","typ":"JWT"}'|b64)
  p=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$role" "$(date +%s)" "$exp"|b64)
  s=$(printf '%s.%s' "$h" "$p" | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" | b64)
  printf '%s.%s.%s' "$h" "$p" "$s"
}
ANON_KEY=$(mkjwt anon)
SERVICE_KEY=$(mkjwt service_role)
ok "Chaves JWT geradas"

# Storage API removido — não há buckets em uso. Pode ser adicionado depois se necessário.

# ---------- 7. app (frontend) ----------
log "Copiando aplicação para ${APP_DIR}"
mkdir -p "$APP_DIR"
if [[ "$(realpath "$SRC_DIR")" != "$(realpath "$APP_DIR")" ]]; then
  rsync -a --delete --exclude node_modules --exclude .git "$SRC_DIR"/ "$APP_DIR"/
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cat >"$APP_DIR/.env" <<EOF
VITE_SUPABASE_URL=${SITE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
SUPABASE_URL=${SITE_URL}
SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
PORT=3000
HOST=127.0.0.1
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/.env"

log "Instalando dependências do app"
sudo -u "$APP_USER" bash -lc "cd $APP_DIR && bun install --silent"

log "Compilando frontend"
sudo -u "$APP_USER" bash -lc "cd $APP_DIR && bun run build" >/dev/null

cat >/etc/systemd/system/getlicence-app.service <<EOF
[Unit]
Description=GetLicence App (TanStack)
After=network.target postgresql.service getlicence-postgrest.service getlicence-auth.service
Requires=postgresql.service getlicence-postgrest.service getlicence-auth.service
[Service]
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node local/serve-built.mjs
Restart=always
User=${APP_USER}
[Install]
WantedBy=multi-user.target
EOF

# ---------- 8. Nginx ----------
log "Configurando Nginx"
SERVER_NAME="${APP_DOMAIN:-_}"
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default
cat >/etc/nginx/sites-available/getlicence.conf <<NGINX
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name ${SERVER_NAME};
  client_max_body_size 25m;

  location /auth/v1/ {
    proxy_pass http://127.0.0.1:9999/;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
  location /rest/v1/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header Authorization \$http_authorization;
    proxy_set_header apikey \$http_apikey;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Authorization \$http_authorization;
    proxy_set_header apikey \$http_apikey;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/getlicence.conf /etc/nginx/sites-enabled/getlicence.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null
systemctl reload nginx

# ---------- 9. start services ----------
systemctl daemon-reload
systemctl enable --now getlicence-postgrest getlicence-auth getlicence-app >/dev/null
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1 && break
  sleep 2
done
if ! curl -fsS http://127.0.0.1:3000 >/dev/null; then
  warn "App não respondeu na porta 3000. Últimos logs:"
  journalctl -u getlicence-app -n 80 --no-pager || true
  exit 1
fi

# ---------- 10. admin inicial ----------
log "Criando usuário admin"
ADMIN_EMAIL="admin@getlicence.com"
ADMIN_PASS="admin1234"
RESP=$(curl -s -X POST "http://127.0.0.1:9999/admin/users" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASS}\",\"email_confirm\":true}" || true)
ADMIN_UID=$(echo "$RESP" | jq -r '.id // empty')
if [[ -z "$ADMIN_UID" ]]; then
  ADMIN_UID=$(sudo -u postgres psql -d "$DB_NAME" -tAc \
    "select id from auth.users where email='${ADMIN_EMAIL}' limit 1;" | tr -d '[:space:]')
fi
if [[ -n "$ADMIN_UID" ]]; then
  sudo -u postgres psql -d "$DB_NAME" -c \
    "insert into public.user_roles(user_id, role) values ('${ADMIN_UID}','admin') on conflict (user_id, role) do nothing;" >/dev/null
  ok "Admin pronto (${ADMIN_EMAIL}) — role admin garantida"
else
  warn "Não foi possível obter UID do admin; verifique GoTrue"
fi

# ---------- 11. SSL opcional ----------
if [[ -n "$APP_DOMAIN" ]]; then
  log "Emitindo certificado SSL para ${APP_DOMAIN}"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  certbot --nginx -d "$APP_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect \
    || warn "certbot falhou — confirme que ${APP_DOMAIN} aponta para este servidor"
fi

log "Garantindo permissões de administrador"
ADMIN_UID=$(sudo -u postgres psql -d "$DB_NAME" -tAc \
  "select id from auth.users where email='${ADMIN_EMAIL}' limit 1;" | tr -d '[:space:]')
if [[ -n "$ADMIN_UID" ]]; then
  sudo -u postgres psql -d "$DB_NAME" -c \
    "insert into public.user_roles(user_id, role) values ('${ADMIN_UID}','admin') on conflict (user_id, role) do nothing;" >/dev/null
fi

# ---------- 12. scripts auxiliares ----------
cat >/opt/getlicence/update.sh <<'EOS'
#!/usr/bin/env bash
set -e
cd /opt/getlicence
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  git config --global --add safe.directory /opt/getlicence
  git pull --ff-only
fi
chown -R getlicence:getlicence /opt/getlicence
sudo -u postgres psql -v ON_ERROR_STOP=1 -d getlicence < /opt/getlicence/local/db/init/02_app_schema.sql >/dev/null
ADMIN_UID=$(sudo -u postgres psql -d getlicence -tAc "select id from auth.users where email='admin@getlicence.com' limit 1;" | tr -d '[:space:]')
if [ -n "$ADMIN_UID" ]; then
  sudo -u postgres psql -d getlicence -c "insert into public.user_roles(user_id, role) values ('${ADMIN_UID}','admin') on conflict (user_id, role) do nothing;" >/dev/null
fi
sudo -u getlicence bash -lc 'cd /opt/getlicence && bun install --silent && bun run build'
systemctl restart getlicence-postgrest getlicence-auth getlicence-app
echo "✓ App atualizado"
EOS
cat >/opt/getlicence/backup.sh <<EOS
#!/usr/bin/env bash
set -e
F=/root/getlicence-\$(date +%F-%H%M).sql
sudo -u postgres pg_dump ${DB_NAME} > "\$F"
echo "✓ Backup: \$F"
EOS
cat >/opt/getlicence/uninstall.sh <<EOS
#!/usr/bin/env bash
set -e
systemctl disable --now getlicence-app getlicence-auth getlicence-postgrest || true
rm -f /etc/systemd/system/getlicence-*.service /etc/getlicence-*.env /etc/getlicence-*.conf
rm -f /etc/nginx/sites-enabled/getlicence.conf /etc/nginx/sites-available/getlicence.conf
systemctl reload nginx || true
sudo -u postgres dropdb --if-exists ${DB_NAME}
rm -rf /opt/getlicence
echo "✓ Removido"
EOS
chmod +x /opt/getlicence/*.sh

cat >/root/getlicence-credenciais.txt <<EOF
GetLicence
URL:     ${SITE_URL}
Login:   ${ADMIN_EMAIL}
Senha:   ${ADMIN_PASS}

JWT_SECRET:               ${JWT_SECRET}
SUPABASE_ANON_KEY:        ${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY:${SERVICE_KEY}
POSTGRES_PASSWORD:        ${PG_PASS}
EOF
chmod 600 /root/getlicence-credenciais.txt

echo
echo "============================================================"
echo " ✅ GetLicence instalado com sucesso"
echo "------------------------------------------------------------"
echo " URL:     ${SITE_URL}"
echo " Login:   ${ADMIN_EMAIL}"
echo " Senha:   ${ADMIN_PASS}"
echo " Credenciais completas: /root/getlicence-credenciais.txt"
echo "------------------------------------------------------------"
echo " Comandos úteis:"
echo "   sudo bash /opt/getlicence/update.sh     # atualizar"
echo "   sudo bash /opt/getlicence/backup.sh     # backup do banco"
echo "   sudo bash /opt/getlicence/uninstall.sh  # remover"
echo "============================================================"
