#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ASSUME_YES=0
SKIP_MODEL=0
SKIP_PIP=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    --skip-model) SKIP_MODEL=1 ;;
    --skip-pip) SKIP_PIP=1 ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/install_fireredtts2.sh [--yes] [--skip-model] [--skip-pip]

Installs FireRedTTS-2 for VerbalCoding:
  - clones FireRedTeam/FireRedTTS2 under vendor/FireRedTTS2
  - creates .venv-fireredtts2
  - installs upstream Python dependencies
  - downloads https://huggingface.co/FireRedTeam/FireRedTTS2 weights under pretrained_models/FireRedTTS2
  - creates .local/bin/fireredtts2 wrapper used by TTS_BACKEND=fireredtts2

The model is large. Use --skip-model only if FIREREDTTS2_PRETRAINED_DIR points elsewhere.
USAGE
      exit 0
      ;;
  esac
done

log() { printf '==> %s\n' "$*"; }
warn() { printf 'Warning: %s\n' "$*" >&2; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }
confirm() {
  if [ "$ASSUME_YES" = "1" ]; then return 0; fi
  printf '%s [y/N]: ' "$1" >&2
  read -r answer
  case "$answer" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

if [ "$ASSUME_YES" != "1" ]; then
  confirm 'FireRedTTS-2 can download several GB of model/dependency data. Continue?' || exit 2
fi

mkdir -p vendor .local/bin pretrained_models

if ! has_cmd git; then
  warn 'git is required to install FireRedTTS-2.'
  exit 1
fi
PYTHON_BIN=""
for candidate in python3.12 python3.11 python3; do
  if has_cmd "$candidate"; then PYTHON_BIN="$candidate"; break; fi
done
if [ -z "$PYTHON_BIN" ]; then
  warn 'Python >=3.11 is required to install FireRedTTS-2.'
  exit 1
fi
PYTHON_VERSION="$($PYTHON_BIN - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
case "$PYTHON_VERSION" in
  3.11|3.12|3.13*) ;;
  *) warn "FireRedTTS-2 requires Python >=3.11; found $PYTHON_VERSION at $PYTHON_BIN"; exit 1 ;;
esac

if [ ! -d vendor/FireRedTTS2/.git ]; then
  log 'Cloning FireRedTTS-2'
  git clone --depth 1 https://github.com/FireRedTeam/FireRedTTS2.git vendor/FireRedTTS2
else
  log 'FireRedTTS-2 repo already exists'
fi

if [ "$SKIP_PIP" != "1" ]; then
  if [ ! -x .venv-fireredtts2/bin/python ]; then
    log 'Creating .venv-fireredtts2'
    "$PYTHON_BIN" -m venv .venv-fireredtts2
  fi
  log 'Installing FireRedTTS-2 Python dependencies'
  .venv-fireredtts2/bin/python -m pip install --upgrade pip setuptools wheel
  .venv-fireredtts2/bin/python -m pip install torch torchaudio huggingface_hub
  .venv-fireredtts2/bin/python -m pip install -e vendor/FireRedTTS2
  if [ -f vendor/FireRedTTS2/requirements.txt ]; then
    .venv-fireredtts2/bin/python -m pip install -r vendor/FireRedTTS2/requirements.txt
  fi
fi

if [ "$SKIP_MODEL" != "1" ]; then
  if [ -d pretrained_models/FireRedTTS2 ] && [ "$(find pretrained_models/FireRedTTS2 -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ]; then
    log 'FireRedTTS-2 pretrained model already exists'
  else
    log 'Downloading FireRedTTS-2 weights from https://huggingface.co/FireRedTeam/FireRedTTS2'
    .venv-fireredtts2/bin/huggingface-cli download FireRedTeam/FireRedTTS2 --local-dir pretrained_models/FireRedTTS2 --local-dir-use-symlinks False
  fi
fi

cat > .local/bin/fireredtts2 <<'SH'
#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec "$ROOT/.venv-fireredtts2/bin/python" "$ROOT/integrations/fireredtts2/synth.py" "$@"
SH
chmod +x .local/bin/fireredtts2

log 'Installed .local/bin/fireredtts2 wrapper'
log 'Set FIREREDTTS2_COMMAND=./.local/bin/fireredtts2 and TTS_BACKEND=fireredtts2, then restart VerbalCoding.'
