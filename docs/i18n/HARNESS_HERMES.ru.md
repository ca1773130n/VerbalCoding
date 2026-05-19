# Hermes Agent — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

Hermes Agent — backend VerbalCoding по умолчанию и единственный harness с настоящим контрактом возобновления сессии: контекст между turn-ами держится чисто. Сравнение со встроенным `/voice` Hermes — в [HERMES_VOICE.ru.md](./HERMES_VOICE.ru.md).

## Установка

Официальный гайд: <https://hermes-agent.nousresearch.com>. Сначала проверьте CLI:

```bash
hermes chat -Q -q "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=hermes
HERMES_COMMAND="hermes chat -Q -q"
HERMES_HOME=/Users/you/.hermes
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

Файл сессии лежит в `<repo>/.verbalcoding-session` (можно переопределить через `HERMES_SESSION_FILE`).

## Возобновление сессии

Hermes — единственный встроенный адаптер с возобновлением. После каждого успешного turn адаптер пишет новый `session_id` на диск и добавляет `--resume <id>` к следующему вызову. `!session reset` очищает файл.

Если turn был abort до того, как Hermes выдал `session_id:` в stderr, адаптер читает `~/.hermes/sessions/session_<id>.json`, чтобы восстановить последний ответ ассистента.

## Подробный прогресс

В подробном режиме адаптер убирает флаг `-Q`, и в stdout начинают идти превью `┊ <emoji> <tool>`. Они сводятся в однострочные события прогресса (чтение файлов, веб-поиск, терминал). Без подробного режима в голос идёт только финальный ответ в рамке.

## Голосовые фразы для переключения на Hermes

- en: `"switch to Hermes"`, `"ask Hermes ..."`
- ru: `"переключись на Hermes"`, `"спроси Hermes"`

## Подводные камни

- TTS-префикс при handoff локализован: `"Hermes says: "` / `"Hermes: "`.
- `HERMES_HOME` — самый частый рычаг изоляции проекта; обычно `HERMES_HOME=/Users/you/.hermes/profiles/<project>` в `.env` инстанса.
- В подробном режиме при пустой рамке от Hermes (таймаут) адаптер залезет в JSON сессии за финальным ответом.
