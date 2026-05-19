# Harness-ы для кодинг-агентов

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="README.ru.md">Хаб документации</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a> ·
  <a href="TROUBLESHOOTING.ru.md">Решение проблем</a>
</p>

VerbalCoding не привязан к конкретному агенту: он вызывает установленный CLI кодинг-агент один раз на voice turn, передаёт STT-расшифровку как prompt и проигрывает ответ голосом. Выберите **один** агент по умолчанию; голосовая маршрутизация позволит дотянуться до остальных в течение сессии.

| Harness | Команда по умолчанию | Возобновление сессии | Документ |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.ru.md](./HERMES_VOICE.ru.md) · [HARNESS_HERMES.ru.md](./HARNESS_HERMES.ru.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.ru.md](./HARNESS_CLAUDE.ru.md) |
| Codex | `codex exec` | ❌ (захват последнего сообщения в файл) | [HARNESS_CODEX.ru.md](./HARNESS_CODEX.ru.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.ru.md](./HARNESS_GEMINI.ru.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.ru.md](./HARNESS_OPENCODE.ru.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.ru.md](./HARNESS_OPENCLAW.ru.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.ru.md](./HARNESS_AIDER.ru.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.ru.md](./HARNESS_CURSOR.ru.md) |

## Выбор агента по умолчанию

`vc setup` автоматически находит установленные бинарники и предлагает выбор. Без интерактива:

```bash
# .env или instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

Каждый harness читает свою команду из одноимённой env (`HERMES_COMMAND`, `CLAUDE_COMMAND` и т. д.). Общие env (`AGENT_LABEL`, `AGENT_COMMAND`, `AGENT_SESSION_FILE`, `AGENT_WORKDIR`, `AGENT_PROJECT_CONTEXT`, `AGENT_TASK_TIMEOUT_MS`, `AGENT_CHAT_TIMEOUT_MS`, `AGENT_VERBOSE_PROGRESS`) перекрывают значения по умолчанию.

## Голосовая маршрутизация между harness

После настройки можно дотянуться до любого **установленного** harness без перезапуска:

- `"ask Codex what it thinks"` — маршрут на один turn, следующий turn возвращается к умолчанию.
- `"switch to Aider"` — sticky-маршрут до `"back to default"`.
- Слот `which_agent` в plan-mode — агент сам предлагает, какой backend выполнит план.

Маршрутизатор проверяет наличие бинарника в `PATH` (относительные пути резолвятся относительно workdir активной проектной сессии). Если не установлено — мост спрашивает `"Использовать агент по умолчанию?"` — ответьте `"yes"` для fallback или `"no"` для отмены.

Распознаваемые алиасы: `claude` / `claude code`, `codex`, `gemini` / `gemini cli`, `opencode`, `openclaw`, `aider`, `cursor` / `cursor cli`, `hermes`.

## Общая семантика

Все адаптеры соблюдают:

- **Голосовой plan-mode** — `"plan it first"` озвучивает план, голосом правим, `"approve"` запускает на выбранном harness.
- **Barge-in** — прерывание срезает текущий TTS и abort задачу агента. Sticky-маршрут переживает прерывания; сбрасываются только маршруты на один turn.
- **Подробный прогресс** — `AGENT_VERBOSE_PROGRESS=1` выводит события прогресса. С `SMART_PROGRESS_API_KEY` LLM-сводщик собирает их в одну фразу на батч.
- **Push-уведомления** — `NOTIFY_PROVIDER=ntfy|pushover` + `NOTIFY_MIN_TASK_MS` отправляет push, когда длинная задача завершается и голосовой канал пуст. Debounce по телу + `NOTIFY_DEBOUNCE_MS`.
- **Состояние на канал** — каждый голосовой канал Discord ведёт свою маршрутизацию, состояние плана и буфер последних реплик.
- **Проектные сессии** — `!session new <name> <workdir>` привязывает канал к проекту; (harness, session) адаптеры кэшируются и инвалидируются при rebind.

Детали установки, авторизации и подводные камни — в документах по каждому harness. Полная справка по env: `docs/CONFIGURATION.ru.md`.
