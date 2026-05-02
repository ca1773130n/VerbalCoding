#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${SUPERTONIC_VENV:-$ROOT/.venv-supertonic}"
CACHE_DIR="${SUPERTONIC_CACHE_DIR:-$ROOT/.cache/supertonic}"

python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip wheel setuptools
"$VENV/bin/python" -m pip install supertonic
mkdir -p "$CACHE_DIR"

# Pre-download the model when the installed CLI supports it. If the command is
# unavailable in an older package build, leave download to the first synth call.
SUPERTONIC_CACHE_DIR="$CACHE_DIR" "$VENV/bin/supertonic" download || true

echo "Supertonic installed: $VENV/bin/supertonic"
echo "Set SUPERTONIC_COMMAND=\"$VENV/bin/supertonic\" and TTS_BACKEND=\"supertonic\" to use it."
