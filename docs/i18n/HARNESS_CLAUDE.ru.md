# Claude Code — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

Claude Code — официальный терминальный кодинг-агент Anthropic. VerbalCoding вызывает его через `claude -p`: один turn — один вызов. У `-p` нет стабильного контракта возобновления, поэтому каждый turn начинается с чистого контекста — используйте `AGENT_PROJECT_CONTEXT` и блок hand-off между агентами для непрерывности.

## Установка

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=claude
CLAUDE_COMMAND="claude -p"
AGENT_PROJECT_CONTEXT="Работаем над auth-модулем; решения: oauth=github."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE` для этого harness не используется (Claude `-p` stateless).

## Что получает Claude каждый turn

Каждый turn адаптер добавляет в начало: Discord-преамбулу (en/ru по `VOICE_LANGUAGE`), контекст проекта, недавний контекст текстового канала и саму расшифровку. При cross-agent handoff к этому добавляется блок "Recent user voice" (до 4 реплик) и последние резолвнутые решения плана, чтобы Claude не стартовал «вхолодную».

## Подробный прогресс

Под `-p` Claude не выдаёт стандартный stream. С `AGENT_VERBOSE_PROGRESS=1` адаптер парсит из stdout/stderr упоминания инструментов/файлов/веба — грубее, чем Hermes.

## Голосовые фразы для переключения на Claude Code

- en: `"switch to Claude Code"`, `"ask Claude ..."`, `"let Claude finish this"`
- ru: `"переключись на Claude"`, `"спроси Claude"`

Матчер принимает `claude` и `claude code`. Strict-режим маршрутизации требует точного совпадения.

## Подводные камни

- **Нет возобновления.** Длинные сессии опираются на блок hand-off для переноса решений; внутри одного backend держите краткое резюме в `AGENT_PROJECT_CONTEXT`.
- **Кавычки в путях.** Если `CLAUDE_COMMAND` — абсолютный путь с пробелами (`"/Applications/Claude Code/claude" -p`), проверка установки использует `shellSplit` и обрабатывает кавычки корректно.
- **Истечение auth.** Просрочка `claude login` ловится как non-zero exit; мост сообщает и предлагает fallback, если Claude не был дефолтом.
- **Patch-вывод.** Если turn прерван во время diff, мост не зачитывает diff: говорит "прервано; проверьте текстовый канал".
