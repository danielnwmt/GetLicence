#!/usr/bin/env bash
# Instalador para Ubuntu 22.04/24.04: instala Docker e sobe a stack Supabase local.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Execute como root: sudo bash install.sh"; exit 1; fi

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> apt update + dependencias base"
apt-get update -y
apt-get install -y ca-certificates curl gnupg openssl

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker Engine + plugin compose"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

if [[ ! -f .env ]]; then
  echo "==> Criando .env a partir do .env.example"
  cp .env.example .env
  PG_PASS=$(openssl rand -hex 16)
  JWT=$(openssl rand -hex 32)
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  read -rp "Email do admin inicial: " ADM_EMAIL
  read -rsp "Senha do admin inicial: " ADM_PASS; echo
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADM_EMAIL}|" .env
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADM_PASS}|" .env
  read -rp "URL publica (ex http://SEU-IP:8000) [http://localhost:8000]: " SITE
  SITE="${SITE:-http://localhost:8000}"
  sed -i "s|^SITE_URL=.*|SITE_URL=${SITE}|" .env
fi

echo "==> Gerando chaves anon / service_role"
bash gen-keys.sh ./.env

echo "==> docker compose pull"
docker compose pull

echo "==> docker compose up -d"
docker compose up -d

echo "==> Aguardando GoTrue subir..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$(grep -E '^HTTP_PORT=' .env | cut -d= -f2)/auth/v1/health" >/dev/null 2>&1; then break; fi
  sleep 2
done

# Cria o admin inicial via GoTrue admin API
echo "==> Criando usuario admin inicial"
# shellcheck disable=SC1091
set -a; . ./.env; set +a
HTTP_PORT_VAL="${HTTP_PORT:-8000}"
USER_JSON=$(curl -s -X POST "http://127.0.0.1:${HTTP_PORT_VAL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true}")
echo "$USER_JSON" | head -c 200; echo
USER_ID=$(echo "$USER_JSON" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
if [[ -n "$USER_ID" ]]; then
  docker compose exec -T db psql -U postgres -d postgres -c \
    "insert into public.user_roles(user_id, role) values ('${USER_ID}','admin') on conflict do nothing;"
fi

echo
echo "============================================================"
echo " Stack local Supabase no ar."
echo " URL:           http://127.0.0.1:${HTTP_PORT_VAL}"
echo " auth/v1:       http://127.0.0.1:${HTTP_PORT_VAL}/auth/v1/health"
echo " rest/v1:       http://127.0.0.1:${HTTP_PORT_VAL}/rest/v1/"
echo
echo " Use estas variaveis no .env do app Lovable (frontend):"
echo "   VITE_SUPABASE_URL=http://SEU-IP:${HTTP_PORT_VAL}"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}"
echo "   VITE_SUPABASE_PROJECT_ID=local"
echo
echo " Para SSR / server functions:"
echo "   SUPABASE_URL=http://SEU-IP:${HTTP_PORT_VAL}"
echo "   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
echo "============================================================"
