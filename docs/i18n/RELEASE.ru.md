# Заметки о релизе VerbalCoding


## Актуальный setup-процесс

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

Не редактируйте `.env` вручную: используйте `vc setup token` для `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` и `vc setup channels` для `AUTO_JOIN_VOICE_CHANNELS`. Если Docker показывает `Cannot perform IP discovery - socket closed`, в Linux Compose используйте `network_mode: "host"` и удалите `ports:`.

## Текущий релиз-кандидат

VerbalCoding — это голосовой bridge Discord для управления CLI-агентами кодинга голосом. Он ориентирован на публичный релиз; macOS / Apple Silicon — наиболее протестированный путь, а bootstrap-поддержка Linux для распространённых менеджеров пакетов предоставляется по мере возможностей.

### Включено

- Приём голоса Discord через Node `@discordjs/voice`.
- Локальный корейский STT через `whisper.cpp` + Metal.
- Воспроизведение Edge TTS с корейским голосом по умолчанию.
- Универсальный слой адаптеров CLI-харнесов:
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - пользовательская команда
- Поддержка общей голосовой/текстовой сессии для бэкенда Hermes.
- Разбиение длинных TTS-ответов на фрагменты и отзывчивое перебивание.
- Защитные ограничения для diff/code/log, чтобы большой технический вывод не читался вслух.
- Обычный и консервативный режимы чувствительности для помещений по сравнению с шумным/уличным использованием.
- Мастер настройки, `.env.example`, проверка prerequisites через `vc doctor` и bootstrap `./scripts/install.sh --yes` для пакетов ОС, npm-зависимостей, помощника Edge TTS и стандартной модели whisper.cpp.
- Путь установки npm-пакета: `npm install -g verbalcoding`, `vc setup --yes` и `vc start`.
- Необязательный режим подробного прогресса для текстовых обновлений промежуточных шагов во время долгой работы агента.
- Постоянные JSONL-метрики задержки плюс сводка `!latency` / `!metrics` для оптимизации pipeline.
- Более терпеливое ожидание бездействия реплики (`UTTERANCE_IDLE_MS=4500`), чтобы длинные голосовые инструкции с естественными паузами не разделялись на частичный prompt плюс игнорируемую речь во время обработки.
- Изоляция профилей Hermes для нескольких экземпляров: `vc instance setup <name>` автоматически клонирует профиль Hermes в `~/.hermes/profiles/<name>` с workdir экземпляра, заполняет SOUL.md и записывает `HERMES_HOME` в env экземпляра, чтобы память и skills проектов оставались разделёнными; `vc instance start` самовосстанавливает отсутствующий профиль, а `vc doctor` проверяет наличие директории профиля и согласованность `terminal.cwd`.

### Чеклист перед релизом

Запускайте из корня репозитория:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # requires Docker; validates ubuntu:24.04 clean install
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # ok when no Python tests exist
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

Ручной smoke-тест:

1. Запустите bridge через `vc start` или `./run.sh`.
2. Проверьте, что лог содержит `Logged in as <bot-name>`.
3. Проверьте, что лог содержит `Listening in voice channel ... / 일반` или настроенный канал по умолчанию.
4. В Discord выполните `!ping`.
5. В голосе Discord произнесите короткий корейский запрос.
6. Проверьте STT-расшифровку, ответ агента, воспроизведение TTS и поведение перебивания.

### Известные требования

- macOS с Homebrew или Linux с `apt`, `dnf` либо `pacman` для best-effort bootstrap.
- `ffmpeg`; установщик пытается установить его.
- `whisper-cli`; установщик использует Homebrew на macOS или резервную локальную сборку `vendor/whisper.cpp` на Linux.
- Модель по умолчанию в `models/ggml-small-q5_1.bin`; установщик загружает её, если не используется `--skip-model`.
- Edge TTS CLI в `PATH` или локальный `.venv-tts/bin/edge-tts`; установщик создаёт локальный помощник при необходимости.
- Токен Discord-бота в `.env`, `instances/<name>.env`, `~/.zshrc` или runtime env.
- Выбранный CLI-харнес установлен и аутентифицирован.

### Пока не для публичного релиза

Перед публичным релизом стоит добавить:

- GitHub Actions CI.
- Демо-видео / GIF.
- Скриншоты настройки Discord-бота.
- Более широкую проверку Linux на реальных дистрибутивах сверх проверок на уровне скриптов.
- Аудит безопасности всех путей логирования.
