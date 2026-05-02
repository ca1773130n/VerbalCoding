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

if [ "${VERBALCODING_SKIP_CLI_LINK:-0}" != "1" ]; then
  if npm link >/dev/null 2>&1; then
    echo "Installed shell CLI: vc"
  else
    echo "Warning: could not install shell CLI with npm link." >&2
    echo "Run this later from the project root: npm link" >&2
  fi
fi

node scripts/install.mjs "$@"
