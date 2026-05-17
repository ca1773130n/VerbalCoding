#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in -y|--yes) ASSUME_YES=1 ;; esac
done
log() { printf '==> %s\n' "$*"; }
confirm() {
  if [ "$ASSUME_YES" = "1" ]; then return 0; fi
  printf '%s [y/N]: ' "$1" >&2
  read -r answer
  case "$answer" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}
if ! confirm 'Install mlx-audio under this project?'; then
  echo 'Cancelled mlx-audio install.' >&2
  exit 2
fi
PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then PYTHON_BIN="$candidate"; break; fi
  done
fi
[ -n "$PYTHON_BIN" ] || { echo 'python3 is required' >&2; exit 1; }
if [ ! -x .venv-mlxaudio/bin/python ]; then
  log 'Creating .venv-mlxaudio'
  "$PYTHON_BIN" -m venv .venv-mlxaudio
fi
log 'Installing mlx-audio for Apple Silicon'
.venv-mlxaudio/bin/python -m pip install --upgrade pip setuptools wheel >/dev/null
.venv-mlxaudio/bin/python -m pip install --pre mlx-audio
log 'mlx-audio installed. Set TTS_BACKEND=mlxaudio or run: vc tts backend mlx'
