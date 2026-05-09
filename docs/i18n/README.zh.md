# VerbalCoding

**通过 Discord 语音像打电话一样控制 CLI 编程代理。**

[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [Español](README.es.md) · [Français](README.fr.md) · [Русский](README.ru.md)

![VerbalCoding voice-to-agent flow](../assets/figures/verbalcoding-flow.svg)

## Why

VerbalCoding 把 Discord 语音频道变成编程代理的免手控制界面。说出需求，让 CLI 代理工作，然后收到简洁的语音回复、文本转录和进度事件。

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
| 全新安装 | [FRESH_INSTALL.zh.md](FRESH_INSTALL.zh.md) |
| 使用指南 | [USAGE.zh.md](USAGE.zh.md) |
| 配置 | [CONFIGURATION.zh.md](CONFIGURATION.zh.md) |
| 多实例 | [MULTI_INSTANCE.zh.md](MULTI_INSTANCE.zh.md) |
| 发布说明 | [RELEASE.zh.md](RELEASE.zh.md) |

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
