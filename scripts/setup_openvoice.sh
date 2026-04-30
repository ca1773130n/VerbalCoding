#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

OPENVOICE_DIR="${OPENVOICE_DIR:-vendor/OpenVoice}"
OPENVOICE_VENV="${OPENVOICE_VENV:-.venv-openvoice}"

mkdir -p "$(dirname "$OPENVOICE_DIR")" voice-samples
if [ ! -d "$OPENVOICE_DIR/.git" ]; then
  git clone https://github.com/myshell-ai/OpenVoice "$OPENVOICE_DIR"
else
  echo "OpenVoice repo already exists: $OPENVOICE_DIR"
fi

if [ ! -x "$OPENVOICE_VENV/bin/python" ]; then
  python3 -m venv "$OPENVOICE_VENV"
fi
# shellcheck disable=SC1091
. "$OPENVOICE_VENV/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e "$OPENVOICE_DIR"
python -m pip install git+https://github.com/myshell-ai/MeloTTS.git
python -m unidic download || true

cat <<'MSG'
OpenVoice Python environment is installed.
Next manual steps:
1. Download OpenVoice V2 checkpoints from:
   https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip
2. Extract them under vendor/OpenVoice/checkpoints_v2/
3. Put a permitted reference sample at voice-samples/user-reference.wav
4. Run: python3 scripts/openvoice_smoke.py
5. Set TTS_BACKEND=openvoice in .env and restart VerbalCoding.
MSG
