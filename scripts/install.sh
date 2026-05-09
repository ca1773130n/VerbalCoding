#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

RUN_WIZARD=1
BOOTSTRAP_ARGS=()
INSTALL_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --no-wizard) RUN_WIZARD=0 ;;
    --skip-bootstrap) export VERBALCODING_SKIP_BOOTSTRAP=1 ;;
    --yes|--skip-system|--skip-model|--skip-edge-tts) BOOTSTRAP_ARGS+=("$arg") ;;
    *) INSTALL_ARGS+=("$arg") ;;
  esac
done

if [ "${VERBALCODING_SKIP_BOOTSTRAP:-0}" != "1" ]; then
  ./scripts/bootstrap_prereqs.sh "${BOOTSTRAP_ARGS[@]}"
elif [ ! -d node_modules ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "node is required. Install Node.js first, or rerun without VERBALCODING_SKIP_BOOTSTRAP=1." >&2
    exit 1
  fi
  npm install
fi

if [ -x "./.venv-tts/bin/edge-tts" ] && ! command -v edge-tts >/dev/null 2>&1; then
  export EDGE_TTS_COMMAND="$(pwd)/.venv-tts/bin/edge-tts"
fi

if [ "${VERBALCODING_SKIP_CLI_LINK:-0}" != "1" ]; then
  if npm link >/dev/null 2>&1; then
    echo "Installed shell CLI: vc"
  else
    echo "Warning: could not install shell CLI with npm link." >&2
    echo "Run this later from the project root: npm link" >&2
  fi
fi

if [ "$RUN_WIZARD" = "1" ]; then
  node scripts/install.mjs "${INSTALL_ARGS[@]}"
else
  echo "Skipped interactive .env wizard. Run ./scripts/install.sh later or copy .env.example to .env."
fi
