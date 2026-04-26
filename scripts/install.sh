#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "node is required. Install Node.js first." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

node scripts/install.mjs "$@"
