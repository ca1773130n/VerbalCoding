# VerbalCoding

<p align="center">
  <strong>Общайтесь с CLI-агентами для программирования голосом в Discord — почти как по телефону.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20Supertonic%20%7C%20SpeechSwift-0EA5E9">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding превращает голосовой канал Discord в hands-free панель управления агентами для разработки. Скажите задачу, дайте CLI-агенту выполнить работу и получите краткий голосовой ответ — с текстовыми транскриптами, событиями прогресса и защитой от зачитывания длинного кода или логов.

## Возможности

| Что есть | Почему это удобно |
|---|---|
| Голосовое управление прежде всего | Управляйте Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw или своим CLI голосом. |
| Локальный voice loop | Голос Discord → STT `whisper.cpp` → агент → фрагментированное TTS-воспроизведение. |
| Общий контекст голоса и текста | Голосовые реплики и `!ask` могут использовать одну и ту же поддерживаемую сессию агента. |
| Barge-in и режимы чувствительности | Естественно перебивайте воспроизведение и переключайте normal/conservative режимы. |
| Многоязычные voice presets | `vc language ko/en/auto` одновременно меняет STT, язык прогресса и TTS-голос. |
| Изоляция комнат по проектам | Отдельный bot, Hermes profile, сессия, память и логи для каждого проекта. |

## Быстрый старт

```bash
git clone git@github.com:ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
vc doctor
./run.sh
```

## Как это работает

```mermaid
flowchart LR
  A[Discord voice] --> B["@discordjs/voice"]
  B --> C[PCM cleanup + gates]
  C --> D["whisper.cpp STT"]
  D --> E["CLI agent adapter"]
  E --> F["Concise answer"]
  F --> G["Chunked TTS"]
  G --> H["Discord playback"]
```

## Поддерживаемые agent-бэкенды

| Backend | Default command | Session support |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Resume, verbose progress, cancellation, final-answer recovery |
| Claude Code | `claude -p` | CLI session file support through adapter defaults |
| Codex CLI | `codex exec` | CLI session file support through adapter defaults |
| Gemini CLI | `gemini -p` | CLI session file support through adapter defaults |
| OpenCode | `opencode run` | CLI session file support through adapter defaults |
| OpenClaw | `openclaw run` | CLI session file support through adapter defaults |
| Custom | `AGENT_COMMAND` | Bring your own non-interactive command |

## Подробнее

| Guide | What you get |
|---|---|
| [Fresh Install](../FRESH_INSTALL.md) | Чистая установка, загрузка модели, первый запуск |
| [Usage Guide](../USAGE.md) | CLI-команды, команды Discord, режим прогресса, метрики задержек |
| [Configuration](../CONFIGURATION.md) | .env, agent-бэкенды, MCP, TTS и эксплуатационные заметки |
| [Multi-Instance](../MULTI_INSTANCE.md) | Постоянная голосовая комната Discord для каждого проекта |
| [Release Notes](../RELEASE.md) | Текущие возможности и pre-release checklist |

## Карта команд

```bash
vc status
vc language ko|en|auto
vc bot invite CLIENT_ID
vc instance setup NAME
vc instance start NAME
vc doctor
```

## Требования

| Layer | Default |
|---|---|
| Runtime | Node.js 20+, npm |
| Audio | `ffmpeg` |
| STT | `whisper.cpp` / `whisper-cli` |
| Discord | Bot token, Message Content intent, voice permissions |
| Agent | At least one authenticated CLI harness, Hermes Agent by default |
| Platform focus | macOS / Apple Silicon currently gets the most testing |

## Участие

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

## Статус

VerbalCoding is public-release oriented but still early. Demo video/GIF, broader Linux notes, and a formal license file are still TODOs.
