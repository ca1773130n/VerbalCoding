# VerbalCoding

<p align="center"><strong>Работайте с CLI-агентами кодинга голосом в Discord — как по телефону.</strong></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.zh.md">中文</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a>
</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding превращает голосовой канал Discord в hands-free панель управления агентами разработки. Произнесите запрос, дайте CLI-агенту выполнить работу и получите ответ голосом и текстом.

## Главное

| Возможность | Польза |
|---|---|
| Голосовое управление агентами | Управляйте Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw или custom CLI голосом в Discord. |
| Guided setup | `vc setup` guides Discord Developer Portal values, bot token, client ID, and voice channels in one flow. `vc setup token` / `vc setup channels` are for later updates. |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | Если видно `Cannot perform IP discovery - socket closed`, канал найден, но UDP-обнаружение Discord voice не прошло. В Linux Docker используйте `network_mode: "host"` и удалите `ports:` у этого сервиса. |

## Быстрый старт

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## Настройка Discord

`vc setup` проводит через единый поток настройки с открытым Discord Developer Portal: токен, client ID и голосовые каналы автоподключения. Позже для точечного изменения используйте `vc setup token` или `vc setup channels`.

```bash
vc setup
vc bot invite <discord-client-id>
# later updates only:
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## Краткая карта команд

```bash
vc setup                               # guided setup: prerequisites, Discord token, voice channels
vc setup token                         # save/update Discord bot token
vc setup channels "General,Team Voice" # save auto-join voice channel names
vc bot invite CLIENT_ID                 # generate Discord invite URL
vc doctor                               # redacted health check and supported auto-fixes
vc start                                # start the default bridge
vc instance setup NAME                  # create isolated project bot config
vc instance start NAME                  # run that bot in the background
```

## Docker / контейнеры

Если видно `Cannot perform IP discovery - socket closed`, канал найден, но UDP-обнаружение Discord voice не прошло. В Linux Docker используйте `network_mode: "host"` и удалите `ports:` у этого сервиса.

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

## Подробнее

| Руководство | Ссылка |
|---|---|
| Fresh install | [FRESH_INSTALL](docs/i18n/FRESH_INSTALL.ru.md) |
| Usage | [USAGE](docs/i18n/USAGE.ru.md) |
| Configuration | [CONFIGURATION](docs/i18n/CONFIGURATION.ru.md) |
| Troubleshooting | [TROUBLESHOOTING](docs/i18n/TROUBLESHOOTING.ru.md) |
| Multi-instance | [MULTI_INSTANCE](docs/i18n/MULTI_INSTANCE.ru.md) |
