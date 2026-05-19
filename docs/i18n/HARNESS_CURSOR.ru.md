# Cursor CLI — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

Cursor CLI (`cursor-agent`) — терминальный агент Cursor. VerbalCoding вызывает его через `cursor-agent --print --prompt`, передавая расшифровку значением `--prompt`. `--print` держит запуск не интерактивным.

## Установка

```bash
cursor-agent --print --prompt "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=cursor                                       # алиас 'cursor-cli' принимается
CURSOR_COMMAND="cursor-agent --print --prompt"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Голосовые фразы для переключения на Cursor

- en: `"switch to Cursor"`, `"switch to cursor cli"`, `"switch to cursor agent"`
- ru: `"переключись на Cursor"`

Алиасы: `cursor`, `cursor cli`, `cursor-cli`, `cursor agent`, `cursor-agent`.

## Подводные камни

- **Позиция prompt-а.** `--prompt` ждёт значение сразу после; argv-сборщик ставит расшифровку последним позиционным аргументом, поэтому `CURSOR_COMMAND` должна заканчиваться на `--prompt`.
- **Побочные эффекты редактора.** Cursor CLI может трогать cursor-файлы состояния в cwd; изолируйте через `AGENT_WORKDIR`.
- **Нет возобновления.** Непрерывность — через `AGENT_PROJECT_CONTEXT` и блок hand-off.
- **Patch-safety.** При прерывании в момент diff мост не зачитывает diff.
