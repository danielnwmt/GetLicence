#!/usr/bin/env bash
# Instalador GetLicence (Ubuntu 22.04 / 24.04)
# Uso: sudo ./install.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Execute como root: sudo ./install.sh"; exit 1
fi

APP_DIR="/opt/getlicence"
SERVICE_NAME="getlicence"
DB_NAME="getlicence_db"
DB_USER="getlicence_user"
NODE_MAJOR=20

# Pasta atual deve ter este script
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Atualizando apt..."
apt-get update -y

echo "==> Instalando dependências base..."
apt-get install -y curl ca-certificates gnupg lsb-release ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  echo "==> Instalando Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "==> Instalando PostgreSQL..."
  apt-get install -y postgresql postgresql-contrib
  systemctl enable --now postgresql
fi

echo "==> Configurando banco ${DB_NAME}..."
DB_PASS_FILE="/root/.getlicence-db-pass"
if [[ ! -f "$DB_PASS_FILE" ]]; then
  openssl rand -hex 24 > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(cat "$DB_PASS_FILE")"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo "==> Copiando aplicação para ${APP_DIR}..."
mkdir -p "${APP_DIR}"
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .git \
  "${SRC_DIR}/" "${APP_DIR}/"

echo "==> Gerando .env..."
ENV_FILE="${APP_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@getlicence}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}"
  ADMIN_NAME="${ADMIN_NAME:-Administrador}"

  cat > "$ENV_FILE" <<EOF
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=${ADMIN_NAME}
ASAAS_API_KEY=
ASAAS_ENV=sandbox
SICREDI_CLIENT_ID=
SICREDI_CLIENT_SECRET=
SICREDI_CERT_PEM=
SICREDI_CERT_KEY=
SICOOB_CLIENT_ID=
SICOOB_ACCESS_TOKEN=
SICOOB_CERT_PEM=
SICOOB_CERT_KEY=
EOF
  chmod 600 "$ENV_FILE"
  echo "==> .env criado em ${ENV_FILE}"
else
  echo "==> .env já existe — mantendo."
fi

cd "${APP_DIR}"
echo "==> Instalando dependências npm (backend)..."
npm install --omit=dev --no-audit --no-fund
echo "==> Compilando TypeScript (backend)..."
npm install --no-audit --no-fund --save-dev typescript @types/node
npx tsc -p tsconfig.json

if [[ -d "${APP_DIR}/web-src" ]]; then
  echo "==> Buildando frontend (web-src/ -> web/)..."
  cd "${APP_DIR}/web-src"
  npm install --no-audit --no-fund
  npm run build
  cd "${APP_DIR}"
fi

echo "==> Aplicando schema do banco..."
node dist/migrate.js

echo "==> Criando admin inicial (se ainda não existe)..."
node dist/seed-admin.js || true

echo "==> Instalando serviço systemd..."
install -m 0644 "${APP_DIR}/getlicence.service" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

echo "==> Configurando Nginx + SSL (Let's Encrypt)..."
DOMAIN="${DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"

if [[ -z "$DOMAIN" ]]; then
  read -rp "Domínio para o GetLicence (ex: app.seudominio.com) [pular SSL]: " DOMAIN || true
fi

if [[ -n "$DOMAIN" ]]; then
  if [[ -z "$SSL_EMAIL" ]]; then
    read -rp "Email para Let's Encrypt [admin@${DOMAIN}]: " SSL_EMAIL || true
    SSL_EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"
  fi

  echo "==> Instalando nginx e certbot..."
  apt-get install -y nginx certbot python3-certbot-nginx

  NGINX_CONF="/etc/nginx/sites-available/getlicence"
  cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
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
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/getlicence
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

  echo "==> Liberando portas 80/443 no firewall..."
  ufw allow 'Nginx Full' || true

  echo "==> Emitindo certificado SSL para ${DOMAIN}..."
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect || \
    echo "!! Falha ao emitir SSL. Verifique se o DNS de ${DOMAIN} aponta para este servidor e rode novamente: certbot --nginx -d ${DOMAIN}"

  systemctl enable --now certbot.timer || true
  PUBLIC_URL="https://${DOMAIN}"
else
  echo "!! Nenhum domínio informado — SSL não foi instalado."
  PUBLIC_URL="http://$(hostname -I | awk '{print $1}'):3000"
fi

echo
echo "================================================================"
echo " Instalação concluída."
echo " Serviço: systemctl status ${SERVICE_NAME}"
echo " Logs:    journalctl -u ${SERVICE_NAME} -f"
echo " URL:     http://$(hostname -I | awk '{print $1}'):3000"
echo " Health:  curl http://127.0.0.1:3000/api/health"
echo " Login:   ${ADMIN_EMAIL:-admin@getlicence}  /  ${ADMIN_PASSWORD:-admin1234}"
echo "================================================================"
