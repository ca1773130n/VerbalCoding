# VerbalCoding release notes

## Current release candidate

VerbalCoding is a Discord voice bridge for controlling CLI-based coding agents by voice. It is public-release oriented, with macOS / Apple Silicon as the most tested path and best-effort Linux bootstrap support for common package managers. Windows is not supported yet.

### Included

- Discord voice receive via Node `@discordjs/voice`.
- Local Korean STT via `whisper.cpp` + Metal or local Linux build fallback.
- Edge TTS playback with Korean default voice.
- Generic CLI harness adapter layer:
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - custom command
- Shared voice/text session support for Hermes backend.
- Long-answer TTS chunking and responsive barge-in.
- Diff/code/log guardrails so large technical output is not read aloud.
- Normal and conservative sensitivity modes for indoor vs. noisy/outdoor use.
- Public npm setup path: `npm install -g verbalcoding@latest`, `vc setup --yes`, `vc setup token`, `vc setup channels`, `vc doctor`, and `vc start`.
- `vc doctor` redacted prerequisite checker with supported auto-fixes for local media/STT/TTS prerequisites and Hermes CLI on macOS/Linux.
- Discord onboarding helpers: `vc bot invite <client-id>` plus token/client-id registration through `vc setup token`.
- Auto-join channel configuration through `vc setup channels`, `vc setup channel`, and `vc setup voice`.
- Optional verbose progress mode for text-only middle-step updates during long agent work.
- Always-on JSONL latency metrics plus `!latency` / `!metrics` summary.
- More patient utterance idle wait (`UTTERANCE_IDLE_MS=4500`) so long spoken instructions with natural pauses are not split too early.
- Multi-instance Hermes profile isolation: `vc instance setup <name>` auto-clones a Hermes profile to `~/.hermes/profiles/<name>` with the instance workdir, seeds SOUL.md, and writes `HERMES_HOME` into the instance env.

### Pre-release checklist

Run from the repo root:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # requires Docker; validates ubuntu:24.04 clean install
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs scripts/cli.mjs scripts/doctor.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # ok when no Python tests exist
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

Manual smoke test:

1. Configure the app with `vc setup token` and `vc setup channels "<voice-channel>"`.
2. Start the bridge with `vc start` or `./run.sh`.
3. Verify log contains `Logged in as <bot-name>`.
4. Verify log contains `Listening in voice channel ... / <configured channel>`.
5. In Discord, run `!ping`.
6. In Discord voice, say a short Korean request.
7. Verify STT transcript, agent response, TTS playback, and barge-in behavior.

Container smoke note: Docker script checks install quality, not Discord voice UDP. For end-to-end voice in containers, Linux host networking is usually required.

### Known requirements

- macOS with Homebrew, or Linux with `apt`, `dnf`, or `pacman` for best-effort bootstrap.
- `ffmpeg`; setup/doctor attempts to install it.
- `whisper-cli`; setup uses Homebrew on macOS or local `vendor/whisper.cpp` build fallback on Linux.
- Default model at `models/ggml-small-q5_1.bin`; setup downloads it unless `--skip-model` is used.
- Edge TTS CLI on `PATH` or local `.venv-tts/bin/edge-tts`; setup creates the local helper when needed.
- Discord bot token registered with `vc setup token` or present in `.env`, `instances/<name>.env`, `~/.zshrc`, or runtime env.
- Auto-join voice channels registered with `vc setup channels` or present in `AUTO_JOIN_VOICE_CHANNELS`.
- Selected CLI harness installed and authenticated.
- For containerized Discord voice, UDP egress must work; Linux `network_mode: "host"` is the recommended Docker Compose setting.

### Not for public release yet

Before public release, consider adding:

- GitHub Actions CI.
- Demo video / GIF.
- Discord bot setup screenshots.
- Broader Linux validation on real distributions beyond script-level checks.
- Security review of all logging paths.
