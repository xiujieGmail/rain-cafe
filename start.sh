#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 22 或更新版本。"
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
exec npm run dev
