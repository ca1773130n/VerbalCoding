# VerbalCoding release notes

## Current release candidate

VerbalCoding is a Discord voice bridge for controlling CLI-based coding agents by voice. It is currently private and optimized for macOS / Apple Silicon with Korean speech input.

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
- Setup wizard, `.env.example`, and `vc doctor` prerequisite checker.
- Optional verbose progress mode for text-only middle-step updates during long agent work.
- Always-on JSONL latency metrics plus `!latency` / `!metrics` summary for pipeline optimization.
- Lower default utterance idle wait (`UTTERANCE_IDLE_MS=2000`) so STT starts about 0.6s sooner after speech ends.
- Multi-instance Hermes profile isolation: `vc instance setup <name>` auto-clones a Hermes profile to `~/.hermes/profiles/<name>` with the instance workdir, seeds SOUL.md, and writes `HERMES_HOME` into the instance env so per-project memory and skills stay separate; `vc instance start` self-heals a missing profile, and `vc doctor` checks profile-dir presence and `terminal.cwd` consistency.

### Pre-release checklist

Run from the repo root:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
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
