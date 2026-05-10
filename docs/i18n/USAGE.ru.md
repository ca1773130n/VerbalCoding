# Руководство по использованию VerbalCoding

Эта страница содержит эксплуатационные подробности, которые раньше делали README слишком длинным.

## CLI-команды

```bash
vc status                    # show STT language, progress language, and TTS voice
vc language en               # English STT + English progress/TTS voice
vc language ko               # Korean STT + Korean progress/TTS voice
vc language auto             # Whisper auto-detect STT + English progress/TTS voice
vc restart auto status       # show commit-time voice-bot auto-restart setting
vc restart auto on           # enable commit-time voice-bot auto-restart
vc restart auto off          # disable it; this is the default
vc bot invite CLIENT_ID      # print a Discord invite URL with required permissions
vc instance status           # list per-instance bridge configs and process status
vc instance setup NAME       # write instances/NAME.env and create ~/.hermes/profiles/NAME
vc instance start NAME       # start ./run.sh instances/NAME.env detached
vc instance stop NAME        # stop a detached instance and remove its pid file
vc doctor                    # run the redacted doctor check
npm run mcp                  # run the stdio MCP server
```

Изменения языка обновляют `.env`; перезапустите bridge через `./run.sh` или ваш менеджер процессов, чтобы они вступили в силу.

## Режимы запуска

Bridge с одним экземпляром:

```bash
./run.sh
```

Bridge для отдельного экземпляра с локальным override env:

```bash
./run.sh instances/my-project.env
# or
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

Бот автоматически присоединяется к первому настроенному имени канала, по умолчанию `일반,General,general`.

## Команды Discord

Перед подключением команд настройте приложение/бота Discord с помощью исходных руководств:

- Руководство Hermes Agent по Discord: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Официальная документация Discord по ботам: <https://docs.discord.com/developers/bots/overview>

Затем используйте `vc bot invite CLIENT_ID`, чтобы сгенерировать URL приглашения VerbalCoding с текстовыми и голосовыми разрешениями.

| Команда | Назначение |
|---|---|
| `!ping` | Базовая проверка бота |
| `!join` / `!leave` | Войти в голосовой канал или выйти из него |
| `!say <text>` | Произнести текст напрямую через TTS |
| `!voice-test <text>` | Проверить активный TTS-бэкенд/голос |
| `!voice-clone capture` | Сохранить следующую допустимую реплику как референсный образец OpenVoice |
| `!voice-clone status` / `!voice-clone cancel` | Проверить или отменить запись |
| `!ask <prompt>` | Отправить текст через тот же выбранный адаптер харнеса, что и голос |
| `!session status` | Показать текущую проектную/стандартную сессию адаптера |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Создать сессию Hermes в области проекта |
| `!session attach-voice [sessionName] --voice <voice-channel>` | Привязать текстовый канал/тред к голосовому каналу |
| `!session list` | Показать настроенные проектные сессии |
| `!session reset` / `!reset-session` | Очистить файл текущей проектной/стандартной сессии адаптера |
| `!verbose on/off` | Включить или выключить подробные обновления прогресса |
| `!latency` / `!metrics` | Показать сводку недавней задержки |
| `!sensitivity normal/conservative` | Переключить чувствительность перебивания |

Голосовые эквиваленты вроде “외부 모드”, “보수 모드”, “실내”, “기본 감도” и ясные стоп-фразы вроде “잠깐”, “멈춰”, “그만” обрабатываются bridge. Также можно сказать “상세 진행 켜” / “상세 진행 꺼”, чтобы переключить подробный прогресс голосом.

## Изменение голоса

`vc language ko|en|auto` одновременно меняет язык STT, язык прогресса и соответствующий голос TTS по умолчанию. Если нужно изменить только диктора/голос во время работы bridge, скажите это голосом в Discord:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

Работающий bridge распознаёт это как команды управления голосом, обновляет `config/tts-voices.json`, обновляет эффективное TTS-окружение для текущего процесса и отвечает коротким подтверждением вроде “목소리를 Korean male로 바꿨어.” Используйте `!voice-test <text>` сразу после изменения, чтобы услышать текущий бэкенд и голос.

Встроенные типы голосов Edge:

| Тип голоса | Голос Edge |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

Для постоянной ручной конфигурации задайте `TTS_BACKEND=edge`, `TTS_VOICE_TYPE=<voice-type>` и, при необходимости, `TTS_VOICE=<edge-voice>` в `.env` либо отредактируйте `config/tts-voices.json` для пользовательских каталогов голосов.

Параметры голоса для конкретных бэкендов:

| Бэкенд | Настройка голоса | Распространённые варианты |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female`; любой голос Edge из `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`; задайте `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | разрешённый референсный WAV плюс стиль, например `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | референсный WAV для CosyVoice или поддерживаемые бэкендом значения диктора/модели |

Для Supertonic и локальных бэкендов клонирования используйте переменные окружения бэкенда выше плюс `!voice-test <text>`, чтобы прослушать изменения. Переключение голосовой командой сейчас сопоставляет встроенные типы голосов в стиле Edge; более богатые каталоги бэкендов можно добавить в `config/tts-voices.json`.

## Длинная диктовка и паузы

VerbalCoding ждёт окно бездействия перед отправкой речи в STT. Значение по умолчанию `UTTERANCE_IDLE_MS=4500` намеренно немного терпеливое, чтобы естественная пауза в длинной инструкции не разделяла предложение, не запускала ход агента слишком рано и не воспринимала остаток как прерывание во время обработки.

Если вы предпочитаете более быстрые короткие команды, уменьшите значение в `.env`; если длинная корейская диктовка всё ещё разбивается, увеличьте его:

```bash
UTTERANCE_IDLE_MS="6000"
```

## Режим подробного прогресса

Подробный прогресс по умолчанию выключен, если не задано `AGENT_VERBOSE_PROGRESS=1`. Включите его через `!verbose on` или голосовой командой вроде “상세 진행 켜”. Он может выводить короткие строки прогресса, например:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

Этот режим просит выбранный CLI-харнес выводить строки `VERBALCODING_PROGRESS: ...` и, когда доступно, суммирует распространённые маркеры инструментов из потокового stdout/stderr. Поля, похожие на секреты, редактируются, а строки прогресса удаляются из финального озвучиваемого ответа.

## Метрики задержки

VerbalCoding записывает записи задержки для каждого хода в формате JSONL. Путь по умолчанию:

```text
./.logs/latency.jsonl
```

Каждая запись включает статус, общее время, время захвата голоса, ожидание бездействия реплики, время STT, время агента, время синтеза/воспроизведения TTS, количество фрагментов, длину расшифровки, длину ответа и уровни аудио, когда они доступны.

В Discord:

```text
!latency
!metrics
```

Сводка использует последние 200 записей: количество, среднее, p95, максимум и статусы не-OK.

## Тестирование

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` намеренно редактирует секреты и сообщает только, настроены ли необходимые значения. Он также проверяет `instances/*.env` на повторяющиеся отпечатки токенов и конфликтующие runtime-пути.
