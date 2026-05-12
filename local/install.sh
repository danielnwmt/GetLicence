#!/usr/bin/env bash
# Instalador automático GetLicence para Ubuntu 22.04 / 24.04
# Uso:  sudo bash install.sh                     (sem SSL, usa IP público)
#       sudo DOMAIN=app.exemplo.com bash install.sh   (com SSL via Let's Encrypt)
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "❌ Execute como root: sudo bash install.sh"; exit 1; fi

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

DOMAIN="${DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"

# ---------- pré-requisitos ----------
log "Instalando dependências base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl gnupg openssl >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker
fi
ok "Docker pronto"

# ---------- detecta IP / URL ----------
if [[ -n "$DOMAIN" ]]; then
  SITE_URL="https://${DOMAIN}"
  SSL_EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"
else
  IPADDR=$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null \
         || curl -s --max-time 4 https://ifconfig.me 2>/dev/null \
         || hostname -I 2>/dev/null | awk '{print $1}' || true)
  IPADDR="${IPADDR:-localhost}"
  SITE_URL="http://${IPADDR}:8000"
  ok "IP detectado: ${IPADDR}"
fi

# ---------- .env ----------
log "Gerando configuração (.env)"
cp -f .env.example .env
PG_PASS=$(openssl rand -hex 16)
JWT=$(openssl rand -hex 32)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@getlicence.com|" .env
sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=admin1234|" .env
sed -i "s|^SITE_URL=.*|SITE_URL=${SITE_URL}|" .env
sed -i "s|^HTTP_PORT=.*|HTTP_PORT=8000|" .env

bash gen-keys.sh ./.env >/dev/null
ok "Chaves anon/service_role geradas"

# ---------- containers ----------
log "Baixando imagens Docker"
docker compose pull -q
log "Subindo serviços"
docker compose up -d --quiet-pull
ok "Containers no ar"

log "Aguardando GoTrue ficar pronto"
for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:8000/auth/v1/health" >/dev/null 2>&1 && break
  sleep 2
done

# ---------- admin inicial ----------
log "Criando usuário admin"
set -a; . ./.env; set +a
USER_JSON=$(curl -s -X POST "http://127.0.0.1:8000/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true}")
USER_ID=$(echo "$USER_JSON" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4 || true)
if [[ -n "$USER_ID" ]]; then
  docker compose exec -T db psql -U postgres -d postgres -c \
    "insert into public.user_roles(user_id, role) values ('${USER_ID}','admin') on conflict do nothing;" >/dev/null || true
  ok "Admin criado (${ADMIN_EMAIL})"
else
  ok "Admin já existia"
fi

# ---------- SSL (opcional) ----------
if [[ -n "$DOMAIN" ]]; then
  log "Configurando Nginx + Let's Encrypt para ${DOMAIN}"
  apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null
  systemctl enable --now nginx
  cat >/etc/nginx/sites-available/getlicence.conf <<NGINX
server {
  listen 80;
  server_name ${DOMAIN};
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
  ln -sf /etc/nginx/sites-available/getlicence.conf /etc/nginx/sites-enabled/getlicence.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect \
    || echo "⚠ certbot falhou — verifique se ${DOMAIN} aponta para este servidor."
fi

# ---------- resumo ----------
echo
echo "============================================================"
echo " ✅ GetLicence instalado com sucesso!"
echo "------------------------------------------------------------"
echo " URL:     ${SITE_URL}"
echo " Login:   admin@getlicence.com"
echo " Senha:   admin1234"
echo "------------------------------------------------------------"
echo " Variáveis para o frontend (.env do Lovable):"
echo "   VITE_SUPABASE_URL=${SITE_URL}"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}"
echo "   VITE_SUPABASE_PROJECT_ID=local"
echo "   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
echo "============================================================"
