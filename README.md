# VerbalCoding

<p align="center">
  <strong>The voice layer for any coding agent — real barge-in, streaming latency, and the agents you already use.</strong>
</p>

<p align="center">
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.zh.md">中文</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.ru.md">Русский</a>
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

## Why it exists

VerbalCoding turns a Discord voice channel into a hands-free cockpit for **any** CLI coding agent. Hermes ships its own `/voice join` for Hermes; VerbalCoding is a thin, agent-agnostic layer that puts the same loop on top of Hermes, Claude Code, Codex, Gemini, OpenCode, OpenClaw, Aider, Cursor CLI, or any non-interactive shell command — with the rough edges other voice frontends still have on their roadmap:

- **True audio barge-in** — interrupt the agent mid-sentence; Hermes' built-in voice pauses its listener during TTS.
- **Streaming pipeline** — first sentence plays while the agent is still writing (Hermes lists this as a future Phase-4 item).
- **Smart progress narration** — describes intent ("wiring the new login route"), not file lists.
- **Voice plan mode** — say "plan it first", edit by voice ("skip step 3"), say "approve" to execute.
- **Phone-down mode** — push notification with a voice summary when a long task completes and the room is empty.

## What feels different

| Capability | Why it matters |
|---|---|
| Agent choice, first-class | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, Aider, Cursor CLI, or any custom command. `vc setup` auto-detects what's installed. |
| Real barge-in | VAD thresholds tuned for indoor and noisy rooms; cut in mid-utterance and resume the conversation. |
| Streaming end-to-end | `STREAMING_TTS=1` plays sentences as the agent produces them; first audio in well under a second on a warm cache. |
| Smart progress | Optional LLM summarizer collapses raw events into one human sentence; falls back to the existing regex labels when no key is set. |
| Plan-mode by voice | Narrated, editable, voice-driven plans without touching the keyboard. |
| Phone-down handoff | Long task + empty VC = push notification (`ntfy`/`pushover`) with a redacted one-line summary and tap-to-rejoin link. |
| Local speech loop | Discord audio is transcribed by local `whisper-cli`; TTS via Edge, OpenVoice, SpeechSwift/CosyVoice, or Supertonic. |
| Real operations support | Doctor auto-fixes, Docker UDP guidance, latency metrics, multi-instance project rooms, redacted config checks. |

> **Already using Hermes Agent?** Hermes itself has a working Discord voice loop via `/voice join` / `/voice channel`. Use VerbalCoding when you want it agent-agnostic, want barge-in and streaming today, or want plan-mode, push handoff, and smart narration on top of the same loop. The two coexist — VerbalCoding can drive Hermes as its backend.

## Quick Start

```bash
npm install -g verbalcoding@latest
vc setup       # detects installed agents and lets you pick
vc doctor
vc start
```

`vc setup` is the normal human path. Keep Discord Developer Portal open while it asks for your bot token, application/client ID, transcript target, and voice channel names.

Automation can skip prompts, then fill Discord details later:

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

Contributor clone path:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
vc doctor
./run.sh
```

## Discord setup in one minute

1. Create a Discord application and bot in <https://discord.com/developers/applications>.
2. Enable the Message Content privileged intent.
3. Run `vc setup` and paste the bot token plus application/client ID when prompted.
4. Enter exact voice channel names for auto-join.
5. Invite the bot with:

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

Secrets are stored in ignored local env files with mode `0600` and are not printed back by `vc doctor`.

## Tiny command map

```bash
vc setup                               # guided setup with agent auto-detection
vc setup --yes                         # non-interactive bootstrap/starter config
vc setup token                         # rotate or add Discord bot token/client ID later
vc setup channels "General,Team Voice" # update auto-join voice channel names
vc bot invite CLIENT_ID                # generate a Discord bot invite URL
vc status                              # show active language, TTS, bridge settings, and resolved backend
vc language ko|en|auto                 # switch STT/progress/TTS language preset
vc doctor                              # redacted health check with auto-fix suggestions
vc start                               # start the default bridge
vc instance setup NAME                 # create an isolated project voice bot
vc instance start NAME                 # run that bot in the background
```

In Discord:

| Command | What it does |
|---|---|
| `!join` / `!leave` | Join or leave your current voice channel. |
| `!ask <prompt>` | Send text to the same selected agent backend. |
| `!verbose on\|off` | Toggle short progress updates. |
| `!latency` / `!metrics` | Summarize recent STT/agent/TTS latency. |
| `!sensitivity normal\|conservative` | Tune barge-in for indoor or noisy environments. |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Bind a project session to a voice room. |

## Roadmap

The differentiation push is tracked in [docs/ROADMAP.md](./docs/ROADMAP.md). Five phases land the claims above:

| # | Phase | What it adds |
|---|---|---|
| 1 | Streaming pipeline | Sentence-by-sentence TTS while the agent is still writing. |
| 2 | Agent-agnostic adapters | First-class Aider + Cursor CLI; `vc setup` auto-detects. |
| 6 | Smart progress | LLM-summarized narration. Falls back to today's regex labels. |
| 7 | Voice plan mode | Narrate plan, voice-edit, approve to execute. |
| 10 | Push notification handoff | ntfy/Pushover when a long task ends and the room is empty. |

## Learn more

| Guide | What you get |
|---|---|
| [Docs hub](docs/README.md) | One page linking every guide and localized doc set. |
| [Roadmap](docs/ROADMAP.md) | Differentiation plan and per-phase implementation plans. |
| [Fresh Install](docs/FRESH_INSTALL.md) | npm/global setup, Discord app setup, token/channel commands, first run. |
| [Usage Guide](docs/USAGE.md) | CLI commands, Discord commands, run modes, voice changes, latency metrics. |
| [Hermes Built-in Voice vs VerbalCoding](docs/HERMES_VOICE.md) | What Hermes already supports and when VerbalCoding is worth adding. |
| [Configuration](docs/CONFIGURATION.md) | `.env`, agent backends, MCP server, TTS backends, operational notes. |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Docker host networking, UDP voice failures, missing token/channel diagnostics. |
| [Multi-Instance](docs/MULTI_INSTANCE.md) | One permanent Discord voice room per project. |
| [Release Notes](docs/RELEASE.md) | Current capabilities, checks, and public-release gaps. |

## Requirements

| Layer | Default |
|---|---|
| Runtime | Node.js 20+ and npm; setup can install via Homebrew/apt/dnf/pacman where supported. |
| Audio | `ffmpeg`; setup/doctor can install it on supported OSes. |
| Speech recognition | Local `whisper-cli` from whisper.cpp plus `models/ggml-small-q5_1.bin`. |
| TTS | Edge TTS by default; optional OpenVoice, SpeechSwift/CosyVoice, Supertonic, OmniVoice, and Qwen3/Q13 TTS CLI paths. |
| Discord | Bot token, Message Content intent, voice permissions, matching auto-join channel names. |
| Agent | At least one CLI harness installed; `vc setup` auto-detects Hermes, Claude Code, Codex, Gemini, OpenCode, OpenClaw, Aider, Cursor CLI. |
| Platform focus | macOS / Apple Silicon most tested; Linux bootstrap is best-effort; Windows unsupported for now. |

## Docker / container note

Discord text login can work while voice join fails if outbound UDP is blocked. If logs show `Cannot perform IP discovery - socket closed`, use Linux host networking for the service that runs `vc start`:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Do not combine `network_mode: "host"` with `ports:`. Docker Desktop for macOS/Windows behaves differently; if UDP still fails there, run VerbalCoding directly on the host or a Linux VM.

## Contributing

Run lightweight checks before sending changes:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## Status

Public-release oriented but still early. The roadmap above tracks live differentiation work. Demo video/GIF, broader Linux validation, CI, and deeper security review are still TODOs.
