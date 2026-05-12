#!/usr/bin/env bash
# Backup do banco GetLicence. Sugestão de cron diário:
#   0 3 * * * /opt/getlicence/backup.sh
set -euo pipefail

BACKUP_DIR="/var/backups/axis"
DB_NAME="getlicence_db"
DB_USER="getlicence_user"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql.gz"

# Usa peer auth se rodando como postgres, senão lê DATABASE_URL do .env
if id postgres >/dev/null 2>&1 && [[ "$(id -un)" == "postgres" ]]; then
  pg_dump "${DB_NAME}" | gzip > "${OUT}"
else
  if [[ -f /opt/getlicence/.env ]]; then
    # shellcheck disable=SC1091
    set -a; . /opt/getlicence/.env; set +a
  fi
  pg_dump "${DATABASE_URL:-postgres://${DB_USER}@127.0.0.1:5432/${DB_NAME}}" | gzip > "${OUT}"
fi

echo "backup salvo: ${OUT}"
find "${BACKUP_DIR}" -name "${DB_NAME}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
