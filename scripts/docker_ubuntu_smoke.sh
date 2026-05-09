#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${VERBALCODING_UBUNTU_IMAGE:-ubuntu:24.04}"
WORK="$(mktemp -d)"
KEEP_WORK="${VERBALCODING_KEEP_SMOKE_WORK:-0}"

cleanup() {
  if [ "$KEEP_WORK" != "1" ]; then rm -rf "$WORK"; fi
}
trap cleanup EXIT

echo "==> Preparing clean tracked-tree copy at $WORK"
git -C "$ROOT" archive --format=tar HEAD | tar -x -C "$WORK"

# Include this script when it is being tested before commit.
if [ -f "$ROOT/scripts/docker_ubuntu_smoke.sh" ] && [ ! -f "$WORK/scripts/docker_ubuntu_smoke.sh" ]; then
  cp "$ROOT/scripts/docker_ubuntu_smoke.sh" "$WORK/scripts/docker_ubuntu_smoke.sh"
  chmod +x "$WORK/scripts/docker_ubuntu_smoke.sh"
fi

echo "==> Running Ubuntu smoke test in $IMAGE"
docker run --rm \
  -e DEBIAN_FRONTEND=noninteractive \
  -e VERBALCODING_SKIP_CLI_LINK=0 \
  -v "$WORK:/work" \
  -w /work \
  "$IMAGE" \
  bash -lc '
    set -euo pipefail
    echo "==> Container OS"
    cat /etc/os-release | sed -n "1,6p"

    echo "==> Bootstrap install without interactive wizard"
    ./scripts/install.sh --yes --no-wizard

    echo "==> Create non-secret smoke .env"
    cat > .env <<"ENV"
DISCORD_BOT_TOKEN="smoke-test-token"
DISCORD_ALLOWED_USERS=""
AUTO_JOIN_VOICE_CHANNELS="General"
TRANSCRIPT_CHANNEL_ID="123456789012345678"
AGENT_BACKEND="custom"
AGENT_LABEL="Smoke Agent"
AGENT_COMMAND="/bin/true"
VOICE_LANGUAGE="en"
WHISPER_CPP_LANGUAGE="en"
STT_LANGUAGE="en"
TTS_BACKEND="edge"
EDGE_TTS_COMMAND="./.venv-tts/bin/edge-tts"
TTS_VOICE="en-US-GuyNeural"
TTS_RATE="+0%"
TTS_VOLUME="1.0"
REQUIRE_WAKE_WORD="0"
UTTERANCE_IDLE_MS="2000"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
ENV
    chmod 600 .env

    echo "==> Verify shell CLI"
    command -v vc
    vc status

    echo "==> Verify syntax and tests"
    bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
    node --check app-node/main.mjs
    node --check scripts/install.mjs
    node --check scripts/cli.mjs
    npm test

    echo "==> Verify doctor passes with smoke env"
    vc doctor

    echo "==> Ubuntu smoke test passed"
  '
