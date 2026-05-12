#!/usr/bin/env bash
# ============================================================
# Instalador Axis Licenças — clona do GitHub e instala tudo
# Uso (Ubuntu 22.04 / 24.04, como root):
#   curl -fsSL https://raw.githubusercontent.com/danielnwmt/axis-licencas/main/selfhost/setup-from-github.sh | sudo bash
# Ou:
#   wget -O- https://raw.githubusercontent.com/danielnwmt/axis-licencas/main/selfhost/setup-from-github.sh | sudo bash
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Execute como root: sudo bash setup-from-github.sh"; exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/danielnwmt/axis-licencas.git}"
BRANCH="${BRANCH:-main}"
CLONE_DIR="${CLONE_DIR:-/opt/axis-licencas-src}"
APP_DIR="/opt/axis-licencas"

echo "============================================================"
echo " Axis Licenças — instalação a partir do GitHub"
echo " Repo:   ${REPO_URL}"
echo " Branch: ${BRANCH}"
echo "============================================================"

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

SELFHOST_DIR="${CLONE_DIR}/selfhost"
if [[ ! -f "${SELFHOST_DIR}/install.sh" ]]; then
  echo "ERRO: ${SELFHOST_DIR}/install.sh não encontrado no repositório."
  echo "Confira se a pasta 'selfhost/' existe na branch '${BRANCH}'."
  exit 1
fi

chmod +x "${SELFHOST_DIR}/install.sh" "${SELFHOST_DIR}/update.sh" "${SELFHOST_DIR}/backup.sh" 2>/dev/null || true

echo "==> Executando install.sh oficial..."
cd "${SELFHOST_DIR}"
bash ./install.sh

echo
echo "============================================================"
echo " Instalação concluída via GitHub."
echo " Código-fonte em: ${CLONE_DIR}"
echo " App em:          ${APP_DIR}"
echo
echo " Para atualizar no futuro:"
echo "   cd ${CLONE_DIR} && sudo git pull && cd selfhost && sudo bash update.sh"
echo "============================================================"
