#!/usr/bin/env bash
# Gera SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY a partir do JWT_SECRET do .env
set -euo pipefail
ENV_FILE="${1:-./.env}"
if [[ ! -f "$ENV_FILE" ]]; then echo "Arquivo .env nao encontrado em $ENV_FILE"; exit 1; fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

if [[ -z "${JWT_SECRET:-}" ]]; then echo "JWT_SECRET vazio no .env"; exit 1; fi

b64() { openssl base64 -A | tr -- '+/' '-_' | tr -d '='; }
make_jwt() {
  local role="$1" exp="$2"
  local header payload sig
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$role" "$(date +%s)" "$exp" | b64)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" | b64)
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

# Expira em 10 anos
EXP=$(( $(date +%s) + 60*60*24*365*10 ))
ANON=$(make_jwt anon "$EXP")
SERVICE=$(make_jwt service_role "$EXP")

echo "SUPABASE_ANON_KEY=$ANON"
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE"

# Atualiza o .env in-place
tmp=$(mktemp)
awk -v a="$ANON" -v s="$SERVICE" '
  /^SUPABASE_ANON_KEY=/ { print "SUPABASE_ANON_KEY=" a; next }
  /^SUPABASE_SERVICE_ROLE_KEY=/ { print "SUPABASE_SERVICE_ROLE_KEY=" s; next }
  { print }
' "$ENV_FILE" > "$tmp" && mv "$tmp" "$ENV_FILE"
echo "[gen-keys] .env atualizado."
