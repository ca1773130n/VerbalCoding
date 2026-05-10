# VerbalCoding

<p align="center">
  <strong>Talk to your CLI coding agents through Discord voice — like a phone call for software work.</strong>
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
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20Supertonic%20%7C%20SpeechSwift-0EA5E9">
  <img alt="Agents" src="https://img.shields.io/badge/Agents-Hermes%20%7C%20Claude%20%7C%20Codex%20%7C%20Gemini%20%7C%20OpenCode-111827">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding turns a Discord voice channel into a hands-free control surface for coding agents. Speak a request, let your CLI agent work, and hear a concise answer back — with text transcripts, progress events, and guardrails for noisy code/log output.

## Highlights

| What you get | Why it feels good |
|---|---|
| Voice-first agent control | Talk to Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or any custom CLI harness. |
| Local-first speech loop | Discord voice capture → `whisper.cpp` STT → agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Barge-in and sensitivity modes | Interrupt playback naturally and switch between normal and conservative/noisy environments. |
| Multilingual voice presets | Switch STT, progress language, and TTS voice together with `vc language ko/en/auto`. |
| Multi-room project isolation | Run one bot per project room with isolated Hermes profiles, sessions, memory, and logs. |

## Quick Start

Fastest path with npm:

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

Or run directly without a permanent global install:

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

GitHub clone path for contributors:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes` and `./scripts/install.sh --yes` bootstrap local prerequisites where possible: Node/npm dependencies, `ffmpeg`, `whisper-cli`, the default whisper.cpp model, a local `.venv-tts` Edge TTS helper, and the short `vc` shell command for clone installs. They support macOS/Homebrew plus common Linux package managers (`apt`, `dnf`, `pacman`); rerun with `--no-wizard` for dependency-only setup or `--skip-system` if you want to install OS packages yourself.

Need a clean install walkthrough? Start with [Fresh Install](docs/FRESH_INSTALL.md).

## How It Works

| Step | What happens |
|---:|---|
| 1 | You speak in a Discord voice channel. |
| 2 | VerbalCoding captures audio with `@discordjs/voice`. |
| 3 | Audio is cleaned, gated, and converted for local STT. |
| 4 | `whisper.cpp` turns speech into text. |
| 5 | The selected CLI agent backend receives the request. |
| 6 | The bridge sends concise text updates and speaks the answer back with chunked TTS. |

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

## Learn More

| Guide | What you get |
|---|---|
| [Fresh Install](docs/FRESH_INSTALL.md) | Clean clone setup, model download, first run |
| [Usage Guide](docs/USAGE.md) | CLI commands, Discord commands, progress mode, latency metrics |
| [Configuration](docs/CONFIGURATION.md) | `.env`, agent backends, MCP, TTS backends, operational notes |
| [Multi-Instance](docs/MULTI_INSTANCE.md) | One permanent Discord voice room per project |
| [Release Notes](docs/RELEASE.md) | Current capabilities and pre-release checklist |
| [한국어 문서](docs/i18n/README.ko.md) | npm 설치, 사용법, 설정, 멀티 인스턴스 한국어 가이드 |
| [日本語 docs](docs/i18n/README.ja.md) | npm install, usage, configuration, multi-instance guide in Japanese |
| [中文文档](docs/i18n/README.zh.md) | npm 安装、使用、配置和多实例中文指南 |
| [Español docs](docs/i18n/README.es.md) | Instalación npm, uso, configuración y multiinstancia en español |
| [Français docs](docs/i18n/README.fr.md) | Installation npm, utilisation, configuration et multi-instance en français |
| [Русская документация](docs/i18n/README.ru.md) | npm установка, использование, конфигурация и мульти-инстансы на русском |

## Tiny Command Map

```bash
vc status                 # current language, TTS, and bridge settings
vc language ko|en|auto    # switch STT/progress/TTS language preset
vc bot invite CLIENT_ID   # generate the Discord bot invite URL
vc instance setup NAME    # create an isolated project voice bot
vc instance start NAME    # run that bot in the background
vc doctor                 # redacted health check
vc start                  # start the default bridge
```

In Discord:

```text
!join                         # join your current voice channel
!ask <prompt>                 # send text to the same agent backend
!verbose on|off               # show/speak short progress updates
!latency                      # summarize recent voice/STT/agent/TTS latency
!sensitivity normal           # use normal indoor barge-in sensitivity
!sensitivity conservative     # use stricter noisy/outdoor sensitivity
!session new <name> <workdir> [context] --voice <voice-channel>
                              # bind a project session to a voice room
```

## Requirements

| Layer | Default |
|---|---|
| Runtime | Node.js 20+, npm; install script can install via Homebrew/apt/dnf/pacman |
| Audio | `ffmpeg`; install script can install it |
| STT | `whisper.cpp` / `whisper-cli`; install script uses Homebrew on macOS or local Linux build fallback |
| TTS | Edge TTS CLI; install script creates `.venv-tts` if needed |
| Discord | Bot token, Message Content intent, voice permissions |
| Agent | At least one authenticated CLI harness, Hermes Agent by default |
| Platform focus | macOS / Apple Silicon most tested; Linux bootstrap is best-effort and documented |

## Contributing

Run the lightweight checks before sending changes:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

## Status

VerbalCoding is public-release oriented but still early. Demo video/GIF, broader Linux validation, CI, and deeper security review are still TODOs.
