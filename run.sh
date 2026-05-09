#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Node @discordjs/voice receiver is the active implementation. The earlier Python
# discord-ext-voice-recv path produced corrupted PCM on this Mac/Discord setup.
mkdir -p /tmp/verbalcoding-node-debug
export NODE_AUDIO_DEBUG_DIR="${NODE_AUDIO_DEBUG_DIR:-/tmp/verbalcoding-node-debug}"
export MIN_UTTERANCE_SECONDS="${MIN_UTTERANCE_SECONDS:-1.0}"
export SUBSCRIBE_AFTER_SILENCE_MS="${SUBSCRIBE_AFTER_SILENCE_MS:-2200}"
export UTTERANCE_IDLE_MS="${UTTERANCE_IDLE_MS:-4500}"
export MIN_MEAN_VOLUME_DB="${MIN_MEAN_VOLUME_DB:--35}"
export MIN_MAX_VOLUME_DB="${MIN_MAX_VOLUME_DB:--18}"
export TTS_RATE="${TTS_RATE:-+10%}"
export TTS_MAX_CHARS="${TTS_MAX_CHARS:-495}"
export HERMES_TASK_TIMEOUT_MS="${HERMES_TASK_TIMEOUT_MS:-0}"
export HERMES_CHAT_TIMEOUT_MS="${HERMES_CHAT_TIMEOUT_MS:-45000}"

INSTANCE_ENV="${VERBALCODING_INSTANCE_ENV:-${1:-}}"
if [ -n "$INSTANCE_ENV" ] && [ ! -f "$INSTANCE_ENV" ]; then
  echo "instance env file not found: $INSTANCE_ENV" >&2
  exit 2
fi

# In instance mode, the launcher passes isolated runtime defaults in the
# process environment. Source the shared .env for non-secret/common defaults,
# but do not let it replace the instance launcher defaults or token.
LAUNCH_BRIDGE_LOG_PATH="${BRIDGE_LOG_PATH:-}"
LAUNCH_NODE_AUDIO_DEBUG_DIR="${NODE_AUDIO_DEBUG_DIR:-}"
LAUNCH_PROJECT_SESSIONS_FILE="${PROJECT_SESSIONS_FILE:-}"
LAUNCH_HERMES_SESSION_FILE="${HERMES_SESSION_FILE:-}"
LAUNCH_HERMES_HOME="${HERMES_HOME:-}"
LAUNCH_VERBALCODING_INSTANCE_NAME="${VERBALCODING_INSTANCE_NAME:-}"
LAUNCH_VERBALCODING_INSTANCE_ENV="${VERBALCODING_INSTANCE_ENV:-}"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi
if [ -n "$INSTANCE_ENV" ]; then
  [ -n "$LAUNCH_BRIDGE_LOG_PATH" ] && export BRIDGE_LOG_PATH="$LAUNCH_BRIDGE_LOG_PATH"
  [ -n "$LAUNCH_NODE_AUDIO_DEBUG_DIR" ] && export NODE_AUDIO_DEBUG_DIR="$LAUNCH_NODE_AUDIO_DEBUG_DIR"
  [ -n "$LAUNCH_PROJECT_SESSIONS_FILE" ] && export PROJECT_SESSIONS_FILE="$LAUNCH_PROJECT_SESSIONS_FILE"
  [ -n "$LAUNCH_HERMES_SESSION_FILE" ] && export HERMES_SESSION_FILE="$LAUNCH_HERMES_SESSION_FILE"
  [ -n "$LAUNCH_HERMES_HOME" ] && export HERMES_HOME="$LAUNCH_HERMES_HOME"
  [ -n "$LAUNCH_VERBALCODING_INSTANCE_NAME" ] && export VERBALCODING_INSTANCE_NAME="$LAUNCH_VERBALCODING_INSTANCE_NAME"
  [ -n "$LAUNCH_VERBALCODING_INSTANCE_ENV" ] && export VERBALCODING_INSTANCE_ENV="$LAUNCH_VERBALCODING_INSTANCE_ENV"
  unset DISCORD_BOT_TOKEN DISCORD_TOKEN
  set -a
  # shellcheck disable=SC1090
  source "$INSTANCE_ENV"
  set +a
fi

mkdir -p "$NODE_AUDIO_DEBUG_DIR"

if [ "${TTS_BACKEND:-}" = "speechswift" ] && [ "${SPEECHSWIFT_MODE:-cli}" = "server" ]; then
  export SPEECHSWIFT_SERVER_HOST="${SPEECHSWIFT_SERVER_HOST:-127.0.0.1}"
  export SPEECHSWIFT_SERVER_PORT="${SPEECHSWIFT_SERVER_PORT:-18080}"
  export SPEECHSWIFT_SERVER_URL="${SPEECHSWIFT_SERVER_URL:-http://${SPEECHSWIFT_SERVER_HOST}:${SPEECHSWIFT_SERVER_PORT}}"
  if command -v audio-server >/dev/null 2>&1; then
    if ! curl -fsS --max-time 1 "${SPEECHSWIFT_SERVER_URL%/}/health" >/dev/null 2>&1; then
      mkdir -p .logs
      audio-server --host "$SPEECHSWIFT_SERVER_HOST" --port "$SPEECHSWIFT_SERVER_PORT" >> .logs/speechswift-audio-server.log 2>&1 &
      export SPEECHSWIFT_SERVER_PID="$!"
      for _ in 1 2 3 4 5; do
        curl -fsS --max-time 1 "${SPEECHSWIFT_SERVER_URL%/}/health" >/dev/null 2>&1 && break
        sleep 1
      done
    fi
  else
    echo "speech-swift server mode requested but audio-server was not found; TTS will fall back if server calls fail" >&2
  fi
fi
export PYTHONUNBUFFERED=1

if [ ! -d node_modules ]; then
  npm install
fi

exec node app-node/main.mjs
