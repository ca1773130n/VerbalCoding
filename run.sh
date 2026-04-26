#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Node @discordjs/voice receiver is the active implementation. The earlier Python
# discord-ext-voice-recv path produced corrupted PCM on this Mac/Discord setup.
mkdir -p /tmp/mouthcode-node-debug
export NODE_AUDIO_DEBUG_DIR="${NODE_AUDIO_DEBUG_DIR:-/tmp/mouthcode-node-debug}"
export MIN_UTTERANCE_SECONDS="${MIN_UTTERANCE_SECONDS:-1.0}"
export SUBSCRIBE_AFTER_SILENCE_MS="${SUBSCRIBE_AFTER_SILENCE_MS:-2200}"
export UTTERANCE_IDLE_MS="${UTTERANCE_IDLE_MS:-2600}"
export MIN_MEAN_VOLUME_DB="${MIN_MEAN_VOLUME_DB:--35}"
export MIN_MAX_VOLUME_DB="${MIN_MAX_VOLUME_DB:--18}"
export TTS_RATE="${TTS_RATE:-+10%}"
export TTS_MAX_CHARS="${TTS_MAX_CHARS:-495}"
export HERMES_TASK_TIMEOUT_MS="${HERMES_TASK_TIMEOUT_MS:-300000}"
export HERMES_CHAT_TIMEOUT_MS="${HERMES_CHAT_TIMEOUT_MS:-45000}"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi
export PYTHONUNBUFFERED=1

if [ ! -d node_modules ]; then
  npm install
fi

exec node app-node/main.mjs
