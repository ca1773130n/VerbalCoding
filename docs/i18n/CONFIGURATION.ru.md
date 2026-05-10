# Конфигурация VerbalCoding


## Актуальный setup-процесс

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

Не редактируйте `.env` вручную: используйте `vc setup token` для `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` и `vc setup channels` для `AUTO_JOIN_VOICE_CHANNELS`. Если Docker показывает `Cannot perform IP discovery - socket closed`, в Linux Compose используйте `network_mode: "host"` и удалите `ports:`.

## Мастер настройки

Настройка Discord-бота/приложения намеренно не объясняется здесь с нуля. Используйте эти исходные руководства для шагов на стороне Discord, затем вернитесь к настройке VerbalCoding:

- Руководство Hermes Agent по сообщениям Discord: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Официальный обзор ботов Discord: <https://docs.discord.com/developers/bots/overview>
- Официальный quick start Discord: <https://docs.discord.com/developers/quick-start/getting-started>

```bash
./scripts/install.sh
```

Установщик спрашивает токен Discord, разрешённых пользователей, имена голосовых каналов для автоподключения, канал/тред расшифровок, бэкенд CLI-харнеса, язык голоса по умолчанию, настройки TTS и поведение wake-word. Он записывает `.env` с режимом `0600`; `.env` игнорируется git. Он также связывает короткую shell-команду `vc`.

Если после ручной установки вам нужна только shell-команда:

```bash
npm link
```

## Поддерживаемые бэкенды агентов

Задайте `AGENT_BACKEND` в `.env`.

| Бэкенд | Команда по умолчанию | Примечания |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | По умолчанию. Сохраняет поведение возобновления `.verbalcoding-session`. |
| `claude-code` / `claude` | `claude -p` | Переопределяется через `CLAUDE_COMMAND` или `AGENT_COMMAND`. |
| `codex` | `codex exec` | Переопределяется через `CODEX_COMMAND` или `AGENT_COMMAND`. |
| `gemini` | `gemini -p` | Переопределяется через `GEMINI_COMMAND` или `AGENT_COMMAND`. |
| `opencode` | `opencode run` | Переопределяется через `OPENCODE_COMMAND` или `AGENT_COMMAND`. |
| `openclaw` | `openclaw run` | Переопределяется через `OPENCLAW_COMMAND` или `AGENT_COMMAND`. |
| `custom` | требуется `AGENT_COMMAND` | Prompt добавляется как финальный аргумент argv. |

Общие переопределения:

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=4500
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## Контракт адаптера агента

Голосовой bridge взаимодействует с каждым бэкендом через единый контракт адаптера:

- `run({ text }, signal, plan)` возвращает статус, текст финального ответа, метку бэкенда, прошедшее время и необязательные метаданные сессии.
- `ask(text, signal, plan)` — совместимый короткий путь, который возвращает только текст финального ответа.
- `capabilities` объявляет, поддерживает ли бэкенд возобновление сессии, потоковый прогресс и отмену.
- Hermes — эталонный адаптер: возобновление, потоковый подробный прогресс, отмена и восстановление финального ответа из файлов сессий Hermes.

Новые бэкенды должны реализовывать тот же контракт и держать поведение voice/STT/TTS вне адаптера.

## Пример `.env`

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_female"
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="4500"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## Выбор голоса TTS

Языковые пресеты и выбор голоса разделены:

- `vc language ko|en|auto` меняет язык STT, язык прогресса и голос по умолчанию для этого языка.
- Живые голосовые команды вроде “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female` и `switch speaker to English` меняют только диктора/тип голоса.
- `!voice-test <text>` воспроизводит быстрый образец с текущим выбранным бэкендом и голосом.

Выбор голоса по умолчанию хранится в `config/tts-voices.json`. Переопределите путь через `TTS_VOICE_CONFIG`. Работающий bridge перечитывает/применяет выбор голоса перед синтезом, поэтому голосовые команды вступают в силу без полного перезапуска.

Стандартный каталог Edge:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | Язык |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | Корейский |
| `korean_female` | `ko-KR-SunHiNeural` | Корейский |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | Корейский |
| `english_male` | `en-US-GuyNeural` | Английский |
| `english_female` | `en-US-AriaNeural` | Английский |

Постоянное ручное переопределение:

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

Для OpenVoice, SpeechSwift или Supertonic храните специфичные для бэкенда настройки голоса/референса в разделах ниже; тот же файл каталога голосов всё равно может отслеживать активный тип голоса.

Голосовые параметры для конкретных бэкендов:

| Бэкенд | Настройки | Варианты голосов |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | Встроенные типы выше, плюс любой голос, возвращаемый `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`; язык `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | Предоставленный пользователем разрешённый референсный WAV; стиль по умолчанию `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | Голоса на базе референсных образцов для CosyVoice или поддерживаемые бэкендом ID диктора/модели |

## Сегментация реплик

`UTTERANCE_IDLE_MS` управляет тем, как долго bridge ждёт после речевого сегмента, прежде чем решить, что пользователь закончил, и запустить STT. Значение по умолчанию — `4500` мс, чтобы сохранять длинные произнесённые инструкции с естественными паузами. Более низкие значения ощущаются быстрее для коротких команд, но могут разделять длинную диктовку; более высокие безопаснее для вдумчивой речи.

```bash
UTTERANCE_IDLE_MS="4500"  # balanced default
UTTERANCE_IDLE_MS="6000"  # safer for long dictation with pauses
```

## MCP-сервер

VerbalCoding поставляется со stdio MCP-сервером, чтобы Hermes Agent или любой MCP-клиент мог управлять bridge через инструменты, а не полагаться на skills или свободные shell-команды.

Пример конфигурации Hermes:

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

Доступные MCP-инструменты:

| Инструмент | Назначение |
|---|---|
| `status` | Сообщить статус bridge/конфигурации без секретов |
| `doctor` | Запустить doctor-проверку с редактированием секретов |
| `set_auto_restart` | Включить/выключить автоперезапуск голосового бота при коммите |
| `set_language` | Обновить STT/прогресс/TTS язык вместе |
| `start`, `stop`, `restart` | Управлять голосовым bridge Discord |

## Необязательный TTS OpenVoice

Edge TTS остаётся стандартным и резервным вариантом. Чтобы попробовать локальное клонирование голоса с OpenVoice V2:

```bash
./scripts/setup_openvoice.sh
# Download checkpoints_v2_0417.zip from OpenVoice docs and extract under vendor/OpenVoice/checkpoints_v2/
mkdir -p voice-samples
# Put a permitted reference sample at voice-samples/user-reference.wav,
# or capture one from Discord with !voice-clone capture.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Затем задайте:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

Клонируйте только голоса, которыми вы владеете или на использование которых у вас есть разрешение. Если OpenVoice завершается ошибкой или по таймауту, VerbalCoding возвращается к Edge TTS.

## Необязательный TTS Supertonic

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

Затем задайте:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

Если Supertonic отсутствует, завершается ошибкой или по таймауту, VerbalCoding возвращается к Edge TTS.

## Необязательный TTS SpeechSwift / CosyVoice

На Apple Silicon `speech-swift` — локальный бэкенд для корейского клонирования голоса с MLX-native CosyVoice/Qwen3-TTS.

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

Рекомендуемое окружение:

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"
SPEECHSWIFT_ENGINE="cosyvoice"
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"
```

Оставьте Edge для быстрых подсказок прогресса/backchannel.

## Эксплуатационные заметки

- Боту нужен включённый привилегированный Discord intent Message Content для текстовых команд.
- Боту нужны разрешения connect/speak в голосовом канале.
- Для Hermes Agent настройте/аутентифицируйте Hermes обычным образом (`hermes setup`, `hermes login` и т. п.) в профиле по умолчанию.
- Для Claude Code, Codex, Gemini, OpenCode, OpenClaw установите и аутентифицируйте эти CLI отдельно.
- Если CLI выводит diff/code при таймауте или сбое сигнала, bridge не читает это вслух и вместо этого отправляет подробный текст.
