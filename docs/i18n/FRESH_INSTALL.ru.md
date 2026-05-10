# Чистая установка

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="README.ru.md">Центр документации</a> ·
  <a href="FRESH_INSTALL.ru.md">Fresh Install</a> ·
  <a href="USAGE.ru.md">Usage</a> ·
  <a href="CONFIGURATION.ru.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.ru.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.ru.md">Multi-Instance</a>
</p>

> Быстрый путь: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

## Актуальный setup-процесс

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

Не редактируйте `.env` вручную: используйте `vc setup token` для `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` и `vc setup channels` для `AUTO_JOIN_VOICE_CHANNELS`. Если Docker показывает `Cannot perform IP discovery - socket closed`, в Linux Compose используйте `network_mode: "host"` и удалите `ports:`.

Это руководство предназначено для чистой публичной установки. Оно избегает локальных предположений и использует установщик, чтобы подготовить как можно больше компонентов.

## 1. Установите CLI

Рекомендуемый путь через npm:

```bash
npm install -g verbalcoding
```

Или запустите опубликованный пакет напрямую:

```bash
npx verbalcoding setup --yes
```

Если вы использовали `npm install -g`, продолжите так:

```bash
vc setup
```

Путь через клон GitHub для контрибьюторов:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. Подготовьте зависимости и запустите мастер настройки

При установке через npm не запускайте `./scripts/install.sh` напрямую: в текущем каталоге нет checkout репозитория. Вместо этого используйте упакованную CLI-обёртку:

```bash
vc setup
```

`vc setup` запускает `scripts/install.sh`, включённый в установленный npm-пакет. Используйте `./scripts/install.sh --yes` только внутри GitHub-клона:

```bash
./scripts/install.sh --yes
```

Что это делает:

- устанавливает npm-зависимости, если отсутствует `node_modules/`,
- устанавливает короткую shell-команду `vc` через `npm link`,
- устанавливает `ffmpeg`, Node/npm и `whisper-cli`, когда это поддерживается менеджером пакетов ОС,
- загружает `models/ggml-small-q5_1.bin`,
- создаёт `.venv-tts` и устанавливает `edge-tts`, если `edge-tts` ещё не находится в `PATH`,
- запускает интерактивный мастер `.env`.

Поддерживаемые пути системного bootstrap:

| ОС | Путь системных зависимостей |
|---|---|
| macOS | Homebrew: `brew install node ffmpeg whisper-cpp` при необходимости |
| Debian/Ubuntu | `apt-get` для Node/npm, ffmpeg, Python, инструментов сборки; резервная локальная сборка whisper.cpp |
| Fedora/RHEL | `dnf` для Node/npm, ffmpeg, Python, инструментов сборки; резервная локальная сборка whisper.cpp |
| Arch | `pacman` для Node/npm, ffmpeg, Python, инструментов сборки; резервная локальная сборка whisper.cpp |

Полезные варианты установщика:

```bash
vc setup --yes --no-wizard                   # dependency/bootstrap only from npm install
./scripts/install.sh --yes --no-wizard       # dependency/bootstrap only from a clone
./scripts/install.sh --skip-system           # do not install OS packages
./scripts/install.sh --skip-model            # do not download the default STT model
./scripts/install.sh --skip-edge-tts         # do not create .venv-tts
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

Если ваша ОС не поддерживается, установите это вручную перед повторным запуском:

- Node.js 20+ и npm
- ffmpeg
- Python 3 с venv/pip
- `whisper-cli` из whisper.cpp
- один аутентифицированный бэкенд CLI-агента, по умолчанию Hermes Agent

## 3. Настройка приложения Discord

Если это ваш первый бот, сначала прочитайте исходные руководства по настройке ботов Discord:

- Руководство Hermes Agent по сообщениям Discord: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Официальный обзор ботов Discord: <https://docs.discord.com/developers/bots/overview>
- Официальное руководство Discord по началу работы: <https://docs.discord.com/developers/quick-start/getting-started>

Эти страницы показывают, как создать приложение Discord, добавить пользователя-бота, включить привилегированные intents и пригласить его на сервер. VerbalCoding использует ту же настройку Discord-бота, а затем добавляет поверх неё приём голоса, STT, выполнение CLI-агента и воспроизведение TTS.

1. Создайте приложение Discord и бота в Discord Developer Portal.
2. Включите привилегированный intent Message Content.
3. Скопируйте токен бота в приглашение установщика или в `.env` как `DISCORD_BOT_TOKEN`.
4. Сгенерируйте URL приглашения:

```bash
vc bot invite <discord-client-id>
# or pin it to one server:
vc bot invite <discord-client-id> --guild <guild-id>
```

Приглашение включает scopes бота и slash-команд, а также текстовые/голосовые разрешения, используемые VerbalCoding.

## 4. Проверьте

```bash
vc doctor
```

`vc doctor` редактирует чувствительные данные: он сообщает об отсутствующих токенах/командах/моделях, не печатая секретные значения. Если отсутствуют исправимые локальные зависимости (`ffmpeg`, `whisper-cli`, стандартная модель или помощник Edge TTS), он сначала автоматически перезапускает упакованный bootstrap. Исправьте оставшиеся пункты `✗`, затем запустите снова.

Ожидаемый успешный результат включает:

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

Если установщик создал локальный помощник Edge TTS, `.env` должен содержать путь `EDGE_TTS_COMMAND`, указывающий на `.venv-tts/bin/edge-tts`.

## 5. Запустите одного бота по умолчанию

```bash
vc start
# or, from a GitHub clone:
./run.sh
```

Логи успешного запуска включают:

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

В Discord:

```text
!ping
!join
!ask say hello briefly
!verbose on
```

Затем говорите в настроенном голосовом канале. Вы должны увидеть текст STT, текст прогресса при включённом подробном режиме, финальный текстовый ответ и услышать воспроизведение TTS.

## 6. Настройка «проект на комнату»

Для одного постоянного бота на голосовую комнату проекта создайте по одному приложению Discord на проект, затем:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

Каждый экземпляр записывает игнорируемый `instances/<name>.env` со своим токеном, голосовым каналом, целью расшифровок, путём лога, файлом сессии Hermes и необязательным профилем Hermes.

## 7. Необязательная настройка OpenVoice

Клонирование голоса OpenVoice необязательно. Для свежей публичной установки оставьте `TTS_BACKEND=edge`. Чтобы позже включить OpenVoice:

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Затем установите `TTS_BACKEND=openvoice`, запустите `vc doctor` и протестируйте `!voice-test <text>` в Discord.

## 8. Smoke-тест чистого клона для сопровождающих

Быстрый smoke-тест только на хосте:

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

Ожидаемая ошибка на этом этапе — отсутствующие локальные секреты или неаутентифицированный CLI агента, а не утёкшие токены или отсутствующие установочные скрипты.

Smoke-тест чистой установки Ubuntu на базе Docker:

```bash
./scripts/docker_ubuntu_smoke.sh
```

Он запускает `ubuntu:24.04`, копирует отслеживаемое дерево репозитория в чистый контейнер, выполняет `./scripts/install.sh --yes --no-wizard`, записывает несекретный smoke `.env`, проверяет `vc`, запускает Node-тесты и проверяет `vc doctor`. Он не подключается к голосу Discord; используйте настоящую Ubuntu VM или WSL2 после этого, если нужен сквозной тест голосового канала.
