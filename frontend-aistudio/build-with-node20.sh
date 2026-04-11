#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION="${NODE_VERSION:-20.19.5}"
NODE_DIST="node-v${NODE_VERSION}-linux-x64"
NODE_ROOT="/tmp/${NODE_DIST}"
NODE_TAR="/tmp/${NODE_DIST}.tar.xz"
NODE_BIN="${NODE_ROOT}/bin/node"
NPM_CLI="${NODE_ROOT}/lib/node_modules/npm/bin/npm-cli.js"

if [[ ! -x "${NODE_BIN}" ]]; then
  echo "Downloading Node ${NODE_VERSION} to /tmp..."
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.xz" -o "${NODE_TAR}"
  tar -xf "${NODE_TAR}" -C /tmp
fi

echo "Using $("${NODE_BIN}" -v)"
"${NODE_BIN}" "${NPM_CLI}" install

if [[ -d "${SCRIPT_DIR}/dist" ]]; then
  BACKUP_DIR="${SCRIPT_DIR}/dist.backup-$(date +%Y-%m-%d-%H%M%S)"
  echo "Backing up existing dist to ${BACKUP_DIR}"
  mv "${SCRIPT_DIR}/dist" "${BACKUP_DIR}"
fi

"${NODE_BIN}" "${NPM_CLI}" run build
