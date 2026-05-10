# VerbalCoding

<p align="center">
  <strong>Разговаривайте с CLI-агентами для кодинга через голос Discord — как по телефону для разработки ПО.</strong>
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
  <img alt="Agents" src="https://img.shields.io/badge/Agents-Hermes%20%7C%20Claude%20%7C%20Codex%20%7C%20Gemini%20%7C%20OpenCode-111827">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="Голосовой поток VerbalCoding к агенту" width="860">
</p>

## Зачем

VerbalCoding превращает голосовой канал Discord в панель управления кодинг-агентами без рук. Произнесите запрос, позвольте CLI-агенту выполнить работу и услышите краткий ответ — с текстовыми расшифровками, событиями прогресса и защитными ограничениями для шумного вывода кода/логов.

## Главное

| Что вы получаете | Почему это удобно |
|---|---|
| Управление агентами голосом в первую очередь | Разговаривайте с Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw или любым пользовательским CLI-харнесом. |
| Речевой цикл на устройстве | Захват голоса Discord → локальная расшифровка `whisper-cli` → агент → фрагментированное воспроизведение TTS. |
| Общий голосовой и текстовый контекст | Голосовые реплики и текстовые команды `!ask` могут повторно использовать одну и ту же поддерживаемую сессию агента. |
| Перебивание и режимы чувствительности | Естественно прерывайте воспроизведение и переключайтесь между обычной и консервативной/шумной средой. |
| Многоязычные голосовые пресеты | Переключайте STT, язык прогресса и голос TTS вместе через `vc language ko/en/auto`. |
| Изоляция проектов по комнатам | Запускайте по одному боту на проектную комнату с отдельными профилями Hermes, сессиями, памятью и логами. |

## Быстрый старт

Самый быстрый путь через npm:

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

Или запуск напрямую без постоянной глобальной установки:

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

Путь через клон GitHub для контрибьюторов:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes` и `./scripts/install.sh --yes` по возможности подготавливают локальные зависимости: зависимости Node/npm, `ffmpeg`, `whisper-cli`, стандартную модель whisper.cpp, локальный помощник Edge TTS в `.venv-tts` и короткую shell-команду `vc` для установок из клона. Они поддерживают macOS/Homebrew и распространённые менеджеры пакетов Linux (`apt`, `dnf`, `pacman`); повторно запустите с `--no-wizard` для установки только зависимостей или с `--skip-system`, если хотите устанавливать пакеты ОС самостоятельно.

Нужно пошаговое руководство по чистой установке? Начните с [Fresh Install](FRESH_INSTALL.ru.md).

## Поддерживаемые бэкенды агентов

| Бэкенд | Команда по умолчанию | Поддержка сессий |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Возобновление, подробный прогресс, отмена, восстановление финального ответа |
| Claude Code | `claude -p` | Поддержка файла сессии CLI через настройки адаптера по умолчанию |
| Codex CLI | `codex exec` | Поддержка файла сессии CLI через настройки адаптера по умолчанию |
| Gemini CLI | `gemini -p` | Поддержка файла сессии CLI через настройки адаптера по умолчанию |
| OpenCode | `opencode run` | Поддержка файла сессии CLI через настройки адаптера по умолчанию |
| OpenClaw | `openclaw run` | Поддержка файла сессии CLI через настройки адаптера по умолчанию |
| Пользовательский | `AGENT_COMMAND` | Подключите собственную неинтерактивную команду |

## Узнать больше

| Руководство | Что вы получите |
|---|---|
| [Чистая установка](FRESH_INSTALL.ru.md) | Настройка чистого клона, загрузка модели, первый запуск |
| [Руководство по использованию](USAGE.ru.md) | CLI-команды, команды Discord, режим прогресса, метрики задержки |
| [Конфигурация](CONFIGURATION.ru.md) | `.env`, бэкенды агентов, MCP, бэкенды TTS, эксплуатационные заметки |
| [Многоэкземплярный режим](MULTI_INSTANCE.ru.md) | Одна постоянная голосовая комната Discord на проект |
| [Заметки о релизе](RELEASE.ru.md) | Текущие возможности и чеклист перед релизом |

## Краткая карта команд

```bash
vc status                 # current language, TTS, and bridge settings
vc language ko|en|auto    # switch STT/progress/TTS language preset
vc bot invite CLIENT_ID   # generate the Discord bot invite URL
vc instance setup NAME    # create an isolated project voice bot
vc instance start NAME    # run that bot in the background
vc doctor                 # redacted health check
vc start                  # start the default bridge
```

В Discord:

| Команда | Что делает |
|---|---|
| `!join` | Подключает бота к вашему текущему голосовому каналу. |
| `!ask <prompt>` | Отправляет текст в тот же бэкенд агента. |
| `!verbose on\|off` | Показывает/озвучивает короткие обновления прогресса. |
| `!latency` | Сводка недавней задержки голоса/STT/агента/TTS. |
| `!sensitivity normal` | Использует обычную чувствительность перебивания для помещений. |
| `!sensitivity conservative` | Использует более строгую чувствительность для шумной/уличной среды. |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Привязывает проектную сессию к голосовой комнате. |

## Требования

| Уровень | По умолчанию |
|---|---|
| Среда выполнения | Node.js 20+, npm; установочный скрипт может установить через Homebrew/apt/dnf/pacman |
| Аудио | `ffmpeg`; установочный скрипт может установить его |
| Распознавание речи | Локальный `whisper-cli` из whisper.cpp; установочный скрипт использует Homebrew на macOS или локальную резервную сборку Linux |
| TTS | Edge TTS CLI; установочный скрипт создаёт `.venv-tts` при необходимости |
| Discord | Токен бота, intent Message Content, голосовые разрешения |
| Агент | Как минимум один аутентифицированный CLI-харнес, по умолчанию Hermes Agent |
| Основная платформа | macOS / Apple Silicon протестированы лучше всего; bootstrap для Linux предоставляется по мере возможностей и документирован |

## Участие в разработке

Перед отправкой изменений выполните лёгкие проверки:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

## Статус

VerbalCoding ориентирован на публичный релиз, но всё ещё находится на ранней стадии. Демо-видео/GIF, более широкая проверка Linux, CI и более глубокий аудит безопасности пока остаются TODO.
