# VerbalCoding

**Discord 음성으로 CLI 코딩 에이전트와 통화하듯 작업하세요.**

[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [Español](README.es.md) · [Français](README.fr.md) · [Русский](README.ru.md)

![VerbalCoding voice-to-agent flow](../assets/figures/verbalcoding-flow.svg)

## Why

VerbalCoding은 Discord 음성 채널을 코딩 에이전트용 핸즈프리 제어면으로 바꿉니다. 말로 요청하고, CLI 에이전트가 작업하게 두고, 간결한 음성 답변과 텍스트 기록을 함께 받습니다.

## Highlights

| Feature | What it means |
|---|---|
| Voice-first agent control | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or a custom CLI harness. |
| Local-first speech loop | Discord voice capture → `whisper.cpp` STT → agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Barge-in and sensitivity modes | Interrupt playback naturally and switch between normal and conservative/noisy modes. |
| Multilingual voice presets | `vc language ko/en/auto` changes STT, progress language, and TTS voice together. |
| Multi-room project isolation | Run one bot per project room with isolated Hermes profiles, sessions, memory, and logs. |

## Quick Start

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

Run without a permanent global install:

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

Contributor clone path:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes` and `./scripts/install.sh --yes` bootstrap npm dependencies, `ffmpeg`, `whisper-cli`, the default whisper.cpp model, a local Edge TTS helper, and the short `vc` command where possible.

## Guides

| Guide | Link |
|---|---|
| 새 설치 | [FRESH_INSTALL.ko.md](FRESH_INSTALL.ko.md) |
| 사용 가이드 | [USAGE.ko.md](USAGE.ko.md) |
| 설정 | [CONFIGURATION.ko.md](CONFIGURATION.ko.md) |
| 멀티 인스턴스 | [MULTI_INSTANCE.ko.md](MULTI_INSTANCE.ko.md) |
| 릴리스 노트 | [RELEASE.ko.md](RELEASE.ko.md) |

## Command map

```bash
vc status
vc language ko|en|auto
vc bot invite CLIENT_ID
vc instance setup NAME
vc instance start NAME
vc doctor
vc start
```

Discord commands:

```text
!join        !ask <prompt>       !verbose on/off
!latency     !sensitivity normal !sensitivity conservative
!session new <name> <workdir> [context] --voice <voice-channel>
```

## Requirements

Node.js 20+, npm, `ffmpeg`, `whisper.cpp` / `whisper-cli`, Edge TTS CLI, a Discord bot token with Message Content intent and voice permissions, and at least one authenticated CLI agent backend.
