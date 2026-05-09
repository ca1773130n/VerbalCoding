# VerbalCoding

**Discord 音声で CLI コーディングエージェントと電話のように作業できます。**

[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [Español](README.es.md) · [Français](README.fr.md) · [Русский](README.ru.md)

![VerbalCoding voice-to-agent flow](../assets/figures/verbalcoding-flow.svg)

## Why

VerbalCoding は Discord の音声チャンネルを、コーディングエージェント向けのハンズフリー操作面に変えます。声で依頼し、CLI エージェントに作業させ、短い音声回答・文字起こし・進捗イベントを受け取れます。

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
| 新規インストール | [FRESH_INSTALL.ja.md](FRESH_INSTALL.ja.md) |
| 使い方ガイド | [USAGE.ja.md](USAGE.ja.md) |
| 設定 | [CONFIGURATION.ja.md](CONFIGURATION.ja.md) |
| マルチインスタンス | [MULTI_INSTANCE.ja.md](MULTI_INSTANCE.ja.md) |
| リリースノート | [RELEASE.ja.md](RELEASE.ja.md) |

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
