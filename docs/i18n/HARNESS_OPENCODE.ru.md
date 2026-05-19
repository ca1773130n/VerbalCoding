# OpenCode — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

OpenCode — open-source терминальный кодинг-агент. VerbalCoding вызывает его через `opencode run`.

## Установка

```bash
opencode run "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=opencode
OPENCODE_COMMAND="opencode run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Голосовые фразы для переключения на OpenCode

- en: `"switch to OpenCode"`, `"switch to open code"`
- ru: `"переключись на OpenCode"`

Алиасы: `opencode`, `open code`.

## Подводные камни

- **По умолчанию нет возобновления.** Если ваша сборка поддерживает resume — добавьте флаг в `OPENCODE_COMMAND`.
- **Выбор модели.** Добавляйте `--model` и прочие флаги прямо в `OPENCODE_COMMAND`.
- **Подробный прогресс.** Матчинг по ключевым словам по stdout/stderr; без `SMART_PROGRESS_API_KEY` fallback на сырые лейблы.
