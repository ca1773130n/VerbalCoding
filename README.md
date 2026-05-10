# VerbalCoding

<p align="center">
  <strong>Talk to CLI coding agents through Discord voice — like a phone call for software work.</strong>
</p>

<p align="center">
  <a href="docs/i18n/README.ko.md">한국어</a> ·
  <a href="docs/i18n/README.ja.md">日本語</a> ·
  <a href="docs/i18n/README.zh.md">中文</a> ·
  <a href="docs/i18n/README.es.md">Español</a> ·
  <a href="docs/i18n/README.fr.md">Français</a> ·
  <a href="docs/i18n/README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20SpeechSwift-0EA5E9">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding turns a Discord voice channel into a hands-free control surface for coding agents. Speak a request, let your CLI agent work, and hear a concise answer back — with text transcripts, progress events, and guardrails so code diffs and logs are not read aloud.

## Highlights

| What you get | Why it feels good |
|---|---|
| Voice-first agent control | Talk to Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or any custom non-interactive CLI. |
| Guided npm setup | `vc setup`, `vc setup token`, `vc setup channels`, and `vc doctor` keep fresh installs out of manual `.env` editing. |
| Local speech loop | Discord voice capture → local `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Barge-in and sensitivity modes | Interrupt playback naturally and switch between normal and conservative/noisy environments. |
| Multi-room project isolation | Run one bot per project room with isolated Hermes profiles, sessions, memory, and logs. |

## Quick Start

Fresh npm install:

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

What each setup step does:

| Command | Purpose |
|---|---|
| `vc setup --yes` | Bootstraps supported local prerequisites and writes a starter `.env`. |
| `vc setup token` | Adds or updates `DISCORD_BOT_TOKEN` and optional `DISCORD_CLIENT_ID` without manual editing. |
| `vc setup channels "..."` | Sets `AUTO_JOIN_VOICE_CHANNELS` to your real Discord voice channel names. |
| `vc doctor` | Redacted health check; auto-fixes installable prerequisites on macOS/Linux where possible. |
| `vc start` | Starts the default voice bridge. |

GitHub clone path for contributors:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc setup token
vc setup channels "General"
vc doctor
./run.sh
```

Need a guided walkthrough? Start with [Fresh Install](docs/FRESH_INSTALL.md).

## Discord Setup in One Minute

1. Create a Discord application/bot in the Developer Portal.
2. Enable the Message Content privileged intent.
3. Invite the bot with the generated URL:

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

4. Register the token and voice rooms:

```bash
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

`vc setup token` stores secrets in the local ignored `.env` with mode `0600` and does not print the token back.

## Supported Agent Backends

| Backend | Default command | Session support |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Resume, verbose progress, cancellation, final-answer recovery |
| Claude Code | `claude -p` | CLI session file support through adapter defaults |
| Codex CLI | `codex exec` | CLI session file support through adapter defaults |
| Gemini CLI | `gemini -p` | CLI session file support through adapter defaults |
| OpenCode | `opencode run` | CLI session file support through adapter defaults |
| OpenClaw | `openclaw run` | CLI session file support through adapter defaults |
| Custom | `AGENT_COMMAND` | Bring your own non-interactive command |

## Tiny Command Map

```bash
vc setup --yes                         # bootstrap supported prerequisites and starter config
vc setup token                         # interactively save/update Discord bot token
vc setup token TOKEN --client-id ID     # non-interactive token/client-id update
vc setup channels "General,Team Voice" # save auto-join voice channel names
vc bot invite CLIENT_ID                 # generate Discord bot invite URL
vc status                               # current language, TTS, and bridge settings
vc language ko|en|auto                  # switch STT/progress/TTS language preset
vc doctor                               # redacted health check and supported auto-fixes
vc start                                # start the default bridge
vc instance setup NAME                  # create an isolated project voice bot
vc instance start NAME                  # run that bot in the background
```

In Discord:

| Command | What it does |
|---|---|
| `!join` | Join your current voice channel. |
| `!ask <prompt>` | Send text to the same agent backend. |
| `!verbose on\|off` | Show/speak short progress updates. |
| `!latency` | Summarize recent voice/STT/agent/TTS latency. |
| `!sensitivity normal` | Use normal indoor barge-in sensitivity. |
| `!sensitivity conservative` | Use stricter noisy/outdoor sensitivity. |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Bind a project session to a voice room. |

## Docker / Container Note

Discord login can work while voice join fails if the container blocks outbound UDP. If logs show `Cannot perform IP discovery - socket closed`, the bot found the channel but Discord voice UDP discovery failed. On Linux Docker, run with host networking:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Do not combine `network_mode: "host"` with `ports:`. Docker Desktop for macOS/Windows has different host-network behavior; if voice UDP still fails there, run VerbalCoding directly on the host or a Linux VM. See [Troubleshooting](docs/TROUBLESHOOTING.md).

## Learn More

| Guide | What you get |
|---|---|
| [Fresh Install](docs/FRESH_INSTALL.md) | npm/global setup, Discord app setup, token/channel commands, first run |
| [Usage Guide](docs/USAGE.md) | CLI commands, Discord commands, run modes, progress mode, latency metrics |
| [Configuration](docs/CONFIGURATION.md) | `.env`, setup command map, agent backends, MCP, TTS backends, operational notes |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Docker host networking, voice UDP failures, missing token/channel diagnostics |
| [Multi-Instance](docs/MULTI_INSTANCE.md) | One permanent Discord voice room per project |
| [Release Notes](docs/RELEASE.md) | Current capabilities and pre-release checklist |

## Requirements

| Layer | Default |
|---|---|
| Runtime | Node.js 20+, npm; setup can install via Homebrew/apt/dnf/pacman where supported |
| Audio | `ffmpeg`; setup/doctor can install it on supported OSes |
| Speech recognition | Local `whisper-cli` from whisper.cpp; setup uses Homebrew on macOS or local Linux build fallback |
| TTS | Edge TTS CLI; setup creates `.venv-tts` if needed |
| Discord | Bot token, Message Content intent, voice permissions, matching auto-join voice channel names |
| Agent | At least one authenticated CLI harness, Hermes Agent by default |
| Platform focus | macOS / Apple Silicon most tested; Linux bootstrap is best-effort; Windows unsupported for now |

## Contributing

Run the lightweight checks before sending changes:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## Status

VerbalCoding is public-release oriented but still early. Demo video/GIF, broader Linux validation, CI, and deeper security review are still TODOs.
