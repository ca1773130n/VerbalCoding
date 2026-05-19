# OpenClaw — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

OpenClaw — open-source терминальный кодинг-агент. VerbalCoding вызывает его через `openclaw run`.

## Установка

```bash
openclaw run "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=openclaw
OPENCLAW_COMMAND="openclaw run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Голосовые фразы для переключения на OpenClaw

- en: `"switch to OpenClaw"`, `"switch to open claw"`
- ru: `"переключись на OpenClaw"`

Алиасы: `openclaw`, `open claw`.

## Подводные камни

- **По умолчанию нет возобновления.** Если сборка поддерживает — добавьте флаг в `OPENCLAW_COMMAND`.
- **Подробный прогресс.** Как у OpenCode.
- **Коллизия имён.** Алиас `openclaw` и метка `OpenClaw` чётко отделены от `claude` / `claude code`; strict-режим маршрутизатора их не путает.
