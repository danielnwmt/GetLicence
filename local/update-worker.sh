#!/usr/bin/env bash
# Worker que escuta a tabela public.system_updates e aplica atualizações
# vindas do painel administrativo (botão "Verificar e Atualizar Sistema").
set -u
DB="${DB_NAME:-getlicence}"
REPO_DIR="${REPO_DIR:-/opt/getlicence}"
UPDATE_SCRIPT="${UPDATE_SCRIPT:-/opt/getlicence/update.sh}"
INTERVAL="${POLL_INTERVAL:-5}"

psqlq() { sudo -u postgres psql -d "$DB" -tAc "$1"; }

log() { echo "[update-worker $(date -Iseconds)] $*"; }

log "iniciando (repo=$REPO_DIR, intervalo=${INTERVAL}s)"

while true; do
  ID=$(psqlq "UPDATE public.system_updates SET status='processing', message='Aplicando atualização na VPS...' WHERE id = (SELECT id FROM public.system_updates WHERE status='pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id;" | tr -d '[:space:]')

  if [[ -n "$ID" ]]; then
    log "processando $ID"
    LOG_FILE=$(mktemp)
    if bash "$UPDATE_SCRIPT" >"$LOG_FILE" 2>&1; then
      VERSION=$(cd "$REPO_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
      MSG=$(tail -c 1000 "$LOG_FILE" | sed "s/'/''/g")
      psqlq "UPDATE public.system_updates SET status='success', version='${VERSION}', message='${MSG}', processed_at=now() WHERE id='${ID}';" >/dev/null
      log "✓ sucesso ($VERSION)"
    else
      MSG=$(tail -c 1500 "$LOG_FILE" | sed "s/'/''/g")
      psqlq "UPDATE public.system_updates SET status='failed', message='${MSG}', processed_at=now() WHERE id='${ID}';" >/dev/null
      log "✗ falha"
    fi
    rm -f "$LOG_FILE"
  fi

  sleep "$INTERVAL"
done
