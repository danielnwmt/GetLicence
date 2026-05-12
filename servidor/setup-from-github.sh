#!/usr/bin/env bash
# ============================================================
# Instalador GetLicence — clona do GitHub e instala tudo
# Uso (Ubuntu 22.04 / 24.04, como root):
#   curl -fsSL https://raw.githubusercontent.com/danielnwmt/GetLicence/main/servidor/setup-from-github.sh | sudo bash
# Ou:
#   wget -O- https://raw.githubusercontent.com/danielnwmt/GetLicence/main/servidor/setup-from-github.sh | sudo bash
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Execute como root: sudo bash setup-from-github.sh"; exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/danielnwmt/GetLicence.git}"
BRANCH="${BRANCH:-main}"
CLONE_DIR="${CLONE_DIR:-/opt/getlicence-src}"
APP_DIR="/opt/getlicence"

echo "============================================================"
echo " GetLicence — instalação a partir do GitHub"
echo " Repo:   ${REPO_URL}"
echo " Branch: ${BRANCH}"
echo "============================================================"

# Pergunta o domínio (lendo do terminal mesmo quando rodado via curl|bash)
if [[ -z "${DOMAIN:-}" ]]; then
  if [[ -r /dev/tty ]]; then
    echo
    read -rp "Domínio para o GetLicence (ex: app.seudominio.com) [vazio = pular SSL]: " DOMAIN < /dev/tty || true
  fi
fi
DOMAIN="${DOMAIN:-}"

if [[ -n "$DOMAIN" && -z "${SSL_EMAIL:-}" ]]; then
  if [[ -r /dev/tty ]]; then
    read -rp "Email para Let's Encrypt [admin@${DOMAIN}]: " SSL_EMAIL < /dev/tty || true
  fi
  SSL_EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"
fi

export DOMAIN SSL_EMAIL

if [[ -n "$DOMAIN" ]]; then
  echo "==> Domínio: ${DOMAIN}  |  Email SSL: ${SSL_EMAIL}"
  echo "    (Confirme que o DNS de ${DOMAIN} já aponta para este servidor)"
else
  echo "==> Sem domínio — SSL será pulado."
fi

echo "==> Atualizando apt e instalando git..."
apt-get update -y
apt-get install -y git ca-certificates curl

echo "==> Clonando/atualizando código em ${CLONE_DIR}..."
if [[ -d "${CLONE_DIR}/.git" ]]; then
  git -C "${CLONE_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${CLONE_DIR}" reset --hard "origin/${BRANCH}"
else
  rm -rf "${CLONE_DIR}"
  git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${CLONE_DIR}"
fi

SERVIDOR_DIR="${CLONE_DIR}/servidor"
if [[ ! -f "${SERVIDOR_DIR}/install.sh" ]]; then
  echo "ERRO: ${SERVIDOR_DIR}/install.sh não encontrado no repositório."
  echo "Confira se a pasta 'servidor/' existe na branch '${BRANCH}'."
  exit 1
fi

chmod +x "${SERVIDOR_DIR}/install.sh" "${SERVIDOR_DIR}/update.sh" "${SERVIDOR_DIR}/backup.sh" 2>/dev/null || true

echo "==> Executando install.sh oficial..."
cd "${SERVIDOR_DIR}"
bash ./install.sh

echo
echo "============================================================"
echo " Instalação concluída via GitHub."
echo " Código-fonte em: ${CLONE_DIR}"
echo " App em:          ${APP_DIR}"
echo
echo " Para atualizar no futuro:"
echo "   cd ${CLONE_DIR} && sudo git pull && cd servidor && sudo bash update.sh"
echo "============================================================"
