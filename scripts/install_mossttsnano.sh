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
if ! confirm 'Install MOSS-TTS-Nano code and Python environment under this project?'; then
  echo 'Cancelled MOSS-TTS-Nano install.' >&2
  exit 2
fi
command -v python3 >/dev/null 2>&1 || { echo 'python3 is required' >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo 'git is required' >&2; exit 1; }
mkdir -p vendor .local/bin
if [ ! -d vendor/MOSS-TTS-Nano/.git ]; then
  log 'Cloning MOSS-TTS-Nano source'
  git clone --depth 1 https://github.com/OpenMOSS/MOSS-TTS-Nano.git vendor/MOSS-TTS-Nano
else
  log 'MOSS-TTS-Nano source already present'
fi
if [ ! -x .venv-mossttsnano/bin/python ]; then
  log 'Creating .venv-mossttsnano'
  python3 -m venv .venv-mossttsnano
fi
log 'Installing MOSS-TTS-Nano Python dependencies'
.venv-mossttsnano/bin/python -m pip install --upgrade pip >/dev/null
if [ -f vendor/MOSS-TTS-Nano/requirements.txt ]; then
  .venv-mossttsnano/bin/python -m pip install -r vendor/MOSS-TTS-Nano/requirements.txt >/dev/null
else
  .venv-mossttsnano/bin/python -m pip install torch torchaudio transformers accelerate soundfile huggingface_hub >/dev/null
fi
cat > .local/bin/mossttsnano <<'SH'
#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec "$ROOT/.venv-mossttsnano/bin/python" "$ROOT/vendor/MOSS-TTS-Nano/infer.py" "$@"
SH
chmod +x .local/bin/mossttsnano
log 'MOSS-TTS-Nano installed: ./.local/bin/mossttsnano'
