# VerbalCoding release notes

## Current release candidate

VerbalCoding is a Discord voice bridge for controlling CLI-based coding agents by voice. It is public-release oriented, with macOS / Apple Silicon as the most tested path and best-effort Linux bootstrap support for common package managers.

### Included

- Discord voice receive via Node `@discordjs/voice`.
- Local Korean STT via `whisper.cpp` + Metal.
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
- Setup wizard, `.env.example`, `vc doctor` prerequisite checker, and `./scripts/install.sh --yes` bootstrap for OS packages, npm dependencies, Edge TTS helper, and the default whisper.cpp model.
- Optional verbose progress mode for text-only middle-step updates during long agent work.
- Always-on JSONL latency metrics plus `!latency` / `!metrics` summary for pipeline optimization.
- Lower default utterance idle wait (`UTTERANCE_IDLE_MS=2000`) so STT starts about 0.6s sooner after speech ends.
- Multi-instance Hermes profile isolation: `vc instance setup <name>` auto-clones a Hermes profile to `~/.hermes/profiles/<name>` with the instance workdir, seeds SOUL.md, and writes `HERMES_HOME` into the instance env so per-project memory and skills stay separate; `vc instance start` self-heals a missing profile, and `vc doctor` checks profile-dir presence and `terminal.cwd` consistency.

### Pre-release checklist

Run from the repo root:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # requires Docker; validates ubuntu:24.04 clean install
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # ok when no Python tests exist
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
vc doctor
git diff --check
```

Manual smoke test:

1. Start the bridge with `./run.sh`.
2. Verify log contains `Logged in as Hermes#6718`.
3. Verify log contains `Listening in voice channel ... / 일반` or the configured default channel.
4. In Discord, run `!ping`.
5. In Discord voice, say a short Korean request.
6. Verify STT transcript, agent response, TTS playback, and barge-in behavior.

### Known requirements

- macOS with Homebrew, or Linux with `apt`, `dnf`, or `pacman` for best-effort bootstrap.
- `ffmpeg`; installer attempts to install it.
- `whisper-cli`; installer uses Homebrew on macOS or local `vendor/whisper.cpp` build fallback on Linux.
- Default model at `models/ggml-small-q5_1.bin`; installer downloads it unless `--skip-model` is used.
- Edge TTS CLI on `PATH` or local `.venv-tts/bin/edge-tts`; installer creates the local helper when needed.
- Discord bot token in `.env`, `instances/<name>.env`, `~/.zshrc`, or runtime env.
- Selected CLI harness installed and authenticated.

### Not for public release yet

Before public release, consider adding:

- GitHub Actions CI.
- Demo video / GIF.
- Discord bot setup screenshots.
- Broader Linux validation on real distributions beyond script-level checks.
- Security review of all logging paths.
