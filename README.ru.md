# VerbalCoding

<p align="center"><strong>Общайтесь с CLI-агентами для разработки голосом в Discord, как по телефону.</strong></p>

<p align="center"><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.zh.md">中文</a> · <a href="./README.es.md">Español</a> · <a href="./README.fr.md">Français</a></p>

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

## Зачем это нужно

VerbalCoding превращает голосовую комнату Discord в hands-free кабину для coding agents. Вы произносите задачу, CLI-агент работает, а в ответ получаете короткую озвучку, текстовую расшифровку и события прогресса. Diffs и logs не зачитываются длинным TTS.

> **Уже используете Hermes Agent?** В Hermes уже есть встроенная поддержка голосовых каналов Discord через `/voice join` / `/voice channel`: бот может зайти в текущий VC, распознать речь через Whisper и ответить TTS. Для этого базового цикла VerbalCoding не обязателен. VerbalCoding добавляет workflow-слой: маршрутизацию проектов/сессий, общий контекст голоса+текста, правила прерывания, голосовой прогресс, языковые пресеты, метрики задержки и переключение CLI-бэкендов помимо Hermes.

## Что ощущается иначе

| Возможность | Зачем это важно |
|---|---|
| Работа как звонок | Говорите, слушайте, перебивайте и продолжайте в одном голосовом канале Discord. |
| Пошаговая настройка | `vc setup` проводит через prerequisites, Discord token/client ID, voice channel, transcript target, backend и TTS settings за один проход. |
| Локальный голосовой цикл | Discord audio → local `whisper-cli` → selected CLI agent → TTS reply. |
| Выбор агента | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, Aider, Cursor CLI или custom command. `vc setup` автоматически находит установленные. |
| Голосовая маршрутизация агента | `"ask Codex what it thinks"` — на один turn, `"switch to Aider"` — sticky, `"back to default"` — возврат. Отсутствующие бинарники определяются и мост предлагает fallback к агенту по умолчанию. |
| Больше, чем встроенный голос Hermes | Сохраняет тот же VC-голосовой цикл и добавляет проектные комнаты, общий контекст `!ask`, тонкую обработку прерываний, голос прогресса/статуса и управление multi-agent бэкендами. |
| Готовность к эксплуатации | doctor auto-fix, Docker UDP guide, latency metrics, multi-instance rooms и redacted config checks встроены. |

## Быстрый старт

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

`vc setup` — обычный путь для человека. Держите Discord Developer Portal открытым и введите bot token, application/client ID, transcript target и voice channel names.

Для автоматизации можно пропустить prompts и добавить Discord-данные позже.

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

## Discord за одну минуту

1. Создайте application и bot в Discord Developer Portal.
2. Включите Message Content privileged intent.
3. Запустите `vc setup` и вставьте bot token и application/client ID.
4. Введите точные имена voice channels для auto-join.
5. Пригласите bot этими командами.

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## Краткая карта команд

```bash
vc setup                                 # пошаговая настройка: prerequisites, Discord, backend, voice
vc setup --yes                           # неинтерактивный bootstrap/starter config
vc setup token                           # позже обновить или добавить Discord bot token/client ID
vc setup channels "General,Team Voice"   # обновить auto-join voice channel names
vc bot invite CLIENT_ID                  # сгенерировать Discord bot invite URL
vc status                                # показать текущие настройки
vc language ko|en|auto                   # переключить language preset
vc doctor                                # redacted health check и auto-fixes
vc start                                 # запустить bridge по умолчанию
vc instance setup NAME                   # создать изолированный project voice bot
vc instance start NAME                   # запустить этот bot в background
```

## Подробнее

| Гайд | Что внутри |
|---|---|
| [Центр документации](docs/i18n/README.ru.md) | Индекс локализованных гайдов. |
| [Fresh Install](docs/i18n/FRESH_INSTALL.ru.md) | npm/global setup, настройка Discord и первый запуск. |
| [Usage](docs/i18n/USAGE.ru.md) | CLI-команды, Discord-команды, режимы запуска и latency. |
| [Использование по harness](docs/i18n/HARNESSES.ru.md) | Установка, настройка и голосовая маршрутизация для Claude Code, Codex, Aider и других. |
| [Встроенный голос Hermes vs VerbalCoding](docs/i18n/HERMES_VOICE.ru.md) | Что Hermes уже умеет в Discord voice и чем отличается VerbalCoding. |
| [Configuration](docs/i18n/CONFIGURATION.ru.md) | .env, agent backends, MCP, TTS и эксплуатация. |
| [Troubleshooting](docs/i18n/TROUBLESHOOTING.ru.md) | Docker UDP и проверки token/channel. |
| [Multi-Instance](docs/i18n/MULTI_INSTANCE.ru.md) | Одна постоянная voice room на проект. |

## Требования

| Слой | По умолчанию |
|---|---|
| Runtime | Node.js 20+ и npm. |
| Audio | `ffmpeg` и local `whisper-cli`. |
| TTS | По умолчанию Edge TTS; опционально OpenVoice, SpeechSwift/CosyVoice, Supertonic. |
| Discord | Bot token, Message Content intent, voice permissions и совпадающие channel names. |
| Agent | Минимум один аутентифицированный CLI harness; по умолчанию Hermes Agent. |

## Docker / контейнеры

Если в logs видно `Cannot perform IP discovery - socket closed`, Discord voice UDP заблокирован. В Linux Docker Compose используйте:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Не совмещайте `network_mode: "host"` с `ports:`.

## Участие

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## Статус

VerbalCoding ориентирован на публичный релиз, но проект ещё ранний. Demo video/GIF, более широкая Linux validation, CI и security review остаются TODO.
