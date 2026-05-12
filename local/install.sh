#!/usr/bin/env bash
# Instalador automático para Ubuntu 22.04/24.04.
# Só pergunta o domínio (opcional, para SSL). Tudo o mais é automático.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Execute como root: sudo bash install.sh"; exit 1; fi

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# ---------- pergunta única: domínio ----------
DOMAIN="${DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"
if [[ -z "$DOMAIN" ]]; then
  if [[ -r /dev/tty ]]; then
    read -rp "Domínio para SSL (ex: app.seudominio.com) [vazio = sem SSL, usar IP:8000]: " DOMAIN < /dev/tty || true
  fi
fi
DOMAIN="${DOMAIN:-}"
if [[ -n "$DOMAIN" && -z "$SSL_EMAIL" ]]; then
  if [[ -r /dev/tty ]]; then
    read -rp "Email para Let's Encrypt [admin@${DOMAIN}]: " SSL_EMAIL < /dev/tty || true
  fi
  SSL_EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"
fi

# ---------- defaults automáticos ----------
ADMIN_EMAIL_DEFAULT="admin@getlicence.com"
ADMIN_PASS_DEFAULT="admin1234"

if [[ -n "$DOMAIN" ]]; then
  SITE_URL_DEFAULT="https://${DOMAIN}"
  HTTP_PORT_DEFAULT="8000"   # Docker escuta em localhost:8000, nginx host faz SSL → :8000
else
  # Detecta IP público automaticamente; faz fallback p/ IP local
  IPADDR=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || true)
  if [[ -z "$IPADDR" ]]; then
    IPADDR=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || true)
  fi
  if [[ -z "$IPADDR" ]]; then
    IPADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  IPADDR="${IPADDR:-localhost}"
  echo "==> IP detectado: ${IPADDR}"
  SITE_URL_DEFAULT="http://${IPADDR}:8000"
  HTTP_PORT_DEFAULT="8000"
fi

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

# ---------- .env totalmente automático ----------
echo "==> Gerando .env automaticamente"
cp -f .env.example .env
PG_PASS=$(openssl rand -hex 16)
JWT=$(openssl rand -hex 32)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL_DEFAULT}|" .env
sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS_DEFAULT}|" .env
sed -i "s|^SITE_URL=.*|SITE_URL=${SITE_URL_DEFAULT}|" .env
sed -i "s|^HTTP_PORT=.*|HTTP_PORT=${HTTP_PORT_DEFAULT}|" .env

echo "==> Gerando chaves anon / service_role"
bash gen-keys.sh ./.env

echo "==> docker compose pull"
docker compose pull

echo "==> docker compose up -d"
docker compose up -d

echo "==> Aguardando GoTrue subir..."
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT_DEFAULT}/auth/v1/health" >/dev/null 2>&1; then break; fi
  sleep 2
done

# ---------- admin inicial via GoTrue ----------
echo "==> Criando usuário admin inicial (${ADMIN_EMAIL_DEFAULT})"
# shellcheck disable=SC1091
set -a; . ./.env; set +a
USER_JSON=$(curl -s -X POST "http://127.0.0.1:${HTTP_PORT_DEFAULT}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true}")
USER_ID=$(echo "$USER_JSON" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
if [[ -n "$USER_ID" ]]; then
  docker compose exec -T db psql -U postgres -d postgres -c \
    "insert into public.user_roles(user_id, role) values ('${USER_ID}','admin') on conflict do nothing;" >/dev/null || true
fi

# ---------- nginx + certbot no host para SSL ----------
if [[ -n "$DOMAIN" ]]; then
  echo "==> Configurando Nginx + Let's Encrypt para ${DOMAIN}"
  apt-get install -y nginx certbot python3-certbot-nginx
  # libera Docker do port 80 e move pra 127.0.0.1:8000 (já é o default acima)
  # garante que o nginx do host ouça :80
  systemctl enable --now nginx

  cat >/etc/nginx/sites-available/getlicence.conf <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:${HTTP_PORT_DEFAULT};
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

  echo "==> Solicitando certificado SSL (Let's Encrypt)"
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect || {
    echo "AVISO: certbot falhou. Verifique se ${DOMAIN} aponta para este servidor (porta 80 aberta)."
  }
fi

# ---------- resumo ----------
echo
echo "============================================================"
echo " ✅ Instalação concluída."
echo
if [[ -n "$DOMAIN" ]]; then
  echo " URL pública:  https://${DOMAIN}"
else
  echo " URL pública:  ${SITE_URL_DEFAULT}"
fi
echo " Admin:        ${ADMIN_EMAIL_DEFAULT}"
echo " Senha:        ${ADMIN_PASS_DEFAULT}"
echo
echo " Variáveis para o .env do frontend Lovable:"
if [[ -n "$DOMAIN" ]]; then
  echo "   VITE_SUPABASE_URL=https://${DOMAIN}"
else
  echo "   VITE_SUPABASE_URL=${SITE_URL_DEFAULT}"
fi
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}"
echo "   VITE_SUPABASE_PROJECT_ID=local"
echo
echo " Service role (SSR / server functions):"
echo "   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
echo "============================================================"
