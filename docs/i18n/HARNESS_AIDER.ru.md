# Aider — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

Aider — CLI для парного программирования с прямыми правками. VerbalCoding вызывает его через `aider --no-pretty --yes-always --message`, передавая prompt значением `--message`. Каждый voice turn — это один не интерактивный запуск Aider, который может изменять файлы в `AGENT_WORKDIR`.

## Установка

```bash
pip install aider-chat
aider --version
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider требует API-ключ выбранной модели (OpenAI / Anthropic / локальный сервер). См. <https://aider.chat>.

## Настройка

```bash
# .env
AGENT_BACKEND=aider
AIDER_COMMAND="aider --no-pretty --yes-always --message"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty` убирает рамки Rich, чтобы sentencer не подвисал. `--yes-always` держит запуск не интерактивным.

## Голосовые фразы для переключения на Aider

- en: `"switch to Aider"`, `"ask Aider to ..."`
- ru: `"переключись на Aider"`

Алиасы: `aider`.

## Подводные камни

- **Aider правит файлы.** В отличие от Claude/Codex/Gemini в `-p`, Aider трогает рабочее дерево в момент ответа. Аккуратно выбирайте `AGENT_WORKDIR` (обычно — `workdir` проектной сессии).
- **Diff в выводе.** При прерывании turn-а мост не зачитывает diff; смотрите текстовый канал и `git status`.
- **Auth.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` должны быть в env Aider; обычно — в `instances/<project>.env`.
- **Состояние на канал.** Маршрутизация cross-agent — на канал Discord; переключение на Aider в одной комнате не влияет на другие.
