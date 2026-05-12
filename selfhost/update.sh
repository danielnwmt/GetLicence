#!/usr/bin/env bash
# Atualiza Axis Licenças mantendo banco e .env intactos.
# Uso: sudo ./update.sh
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Use sudo"; exit 1; fi

APP_DIR="/opt/axis-licencas"
SERVICE_NAME="axis-licencas"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Parando serviço..."
systemctl stop "${SERVICE_NAME}" || true

echo "==> Copiando novos arquivos (preservando .env)..."
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude .env --exclude web \
  "${SRC_DIR}/" "${APP_DIR}/"

cd "${APP_DIR}"
npm install --omit=dev --no-audit --no-fund
npm install --no-audit --no-fund --save-dev typescript @types/node
npx tsc -p tsconfig.json

echo "==> Aplicando migrations..."
node dist/migrate.js

echo "==> Reiniciando serviço..."
systemctl start "${SERVICE_NAME}"
systemctl status "${SERVICE_NAME}" --no-pager
