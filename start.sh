#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 22.13+（22 系列）或 24+。"
  exit 1
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 22 && minor >= 13) || major >= 24 ? 0 : 1)'; then
  echo "请使用 Node.js 22.13+（22 系列）或 24+。"
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
# 允许验收时使用其他端口，默认仍为 3000。
exec npm run dev -- --port "${PORT:-3000}"
