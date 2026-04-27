# VerbalCoding release notes

## Current release candidate

VerbalCoding is a Discord voice bridge for controlling CLI-based coding agents by voice. It is currently private and optimized for macOS / Apple Silicon with Korean speech input.

### Included

- Discord voice receive via Node `@discordjs/voice`.
- Local Korean STT via `whisper.cpp` + Metal.
- Edge TTS playback with Korean default voice.
- Generic CLI harness adapter layer:
  - Hermes Agent
  - Claude Code / Claude CLI
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - custom command
- Shared voice/text session support for Hermes backend.
- Long-answer TTS chunking and responsive barge-in.
- Diff/code/log guardrails so large technical output is not read aloud.
- Normal and conservative sensitivity modes for indoor vs. noisy/outdoor use.
- Setup wizard, `.env.example`, and `npm run doctor` prerequisite checker.
- Optional verbose progress mode for text-only middle-step updates during long agent work.

### Pre-release checklist

Run from the repo root:

```bash
node --check app-node/main.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q
bash -n run.sh scripts/install.sh
npm run doctor
```

Manual smoke test:

1. Start the bridge with `./run.sh`.
2. Verify log contains `Logged in as Hermes#6718`.
3. Verify log contains `Listening in voice channel ... / 일반` or the configured default channel.
4. In Discord, run `!ping`.
5. In Discord voice, say a short Korean request.
6. Verify STT transcript, agent response, TTS playback, and barge-in behavior.

### Known local requirements

- macOS with Homebrew.
- `ffmpeg` installed.
- `whisper-cpp` installed.
- Default model at `models/ggml-small-q5_1.bin`.
- Discord bot token in `.env`, `~/.zshrc`, or runtime env.
- Selected CLI harness installed and authenticated.

### Not for public release yet

Before public release, consider adding:

- GitHub Actions CI.
- Demo video / GIF.
- Discord bot setup screenshots.
- More platform-specific install notes for Linux.
- Security review of all logging paths.
