# VerbalCoding Notes de version

## Current release candidate

VerbalCoding is a Discord voice bridge for controlling CLI-based coding agents by voice. macOS / Apple Silicon is the most tested path; Linux bootstrap is best-effort for common package managers.

## Included

- Discord voice receive via Node `@discordjs/voice`.
- Local Korean STT via `whisper.cpp` + Metal.
- Edge TTS playback with Korean default voice.
- Generic CLI harness adapter layer: Hermes Agent, Claude Code, Codex CLI, Gemini CLI, OpenCode, OpenClaw, or custom command.
- Shared voice/text session support for Hermes backend.
- Long-answer TTS chunking and responsive barge-in.
- Diff/code/log guardrails so large technical output is not read aloud.
- Normal and conservative sensitivity modes.
- Setup wizard, `.env.example`, `vc doctor`, `./scripts/install.sh --yes`, and npm install path.
- `npm install -g verbalcoding`, `vc setup --yes`, and `vc start`.
- Verbose progress mode, JSONL latency metrics, and `!latency` / `!metrics`.
- `UTTERANCE_IDLE_MS=4500` for long spoken instructions with natural pauses.
- Multi-instance Hermes profile isolation via `vc instance setup <name>` and `HERMES_HOME`.

## Pre-release checklist

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

Manual smoke test:

1. Start the bridge with `vc start` or `./run.sh`.
2. Verify `Logged in as <bot-name>`.
3. Verify `Listening in voice channel ...`.
4. In Discord, run `!ping`.
5. Say a short Korean request in voice.
6. Verify STT transcript, agent response, TTS playback, and barge-in.

## Known requirements

- macOS with Homebrew, or Linux with `apt`, `dnf`, or `pacman`.
- `ffmpeg`.
- `whisper-cli`.
- `models/ggml-small-q5_1.bin`.
- Edge TTS CLI or `.venv-tts/bin/edge-tts`.
- Discord bot token in `.env`, `instances/<name>.env`, `~/.zshrc`, or runtime env.
- Selected CLI harness installed and authenticated.

## Not for public release yet

Consider adding GitHub Actions CI, demo video/GIF, Discord bot setup screenshots, broader real Linux validation, and security review of logging paths.
