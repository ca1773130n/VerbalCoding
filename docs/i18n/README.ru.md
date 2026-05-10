# VerbalCoding

<p align="center"><strong>Работайте с CLI-агентами кодинга голосом в Discord — как по телефону.</strong></p>

<p align="center">[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [Español](README.es.md) · [Français](README.fr.md)</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding превращает голосовой канал Discord в hands-free панель управления агентами разработки. Произнесите запрос, дайте CLI-агенту выполнить работу и получите ответ голосом и текстом.

## Главное

| Возможность | Польза |
|---|---|
| Голосовое управление агентами | Управляйте Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw или custom CLI голосом в Discord. |
| Guided setup | Вместо ручного редактирования `.env` используйте `vc setup token` и `vc setup channels`, чтобы сохранить токен и голосовые каналы автоподключения. |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | Если видно `Cannot perform IP discovery - socket closed`, канал найден, но UDP-обнаружение Discord voice не прошло. В Linux Docker используйте `network_mode: "host"` и удалите `ports:` у этого сервиса. |

## Быстрый старт

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

## Настройка Discord

```bash
vc bot invite <discord-client-id>
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## Краткая карта команд

```bash
vc setup --yes                         # bootstrap prerequisites and starter config
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
| Fresh install | [FRESH_INSTALL](FRESH_INSTALL.ru.md) |
| Usage | [USAGE](USAGE.ru.md) |
| Configuration | [CONFIGURATION](CONFIGURATION.ru.md) |
| Troubleshooting | [TROUBLESHOOTING](TROUBLESHOOTING.ru.md) |
| Multi-instance | [MULTI_INSTANCE](MULTI_INSTANCE.ru.md) |
