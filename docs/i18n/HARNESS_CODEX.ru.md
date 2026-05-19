# Codex — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

Codex CLI — терминальный кодинг-агент OpenAI. VerbalCoding вызывает его через `codex exec`. Поскольку `codex exec` пишет финальный текст ассистента во временный файл при `--output-last-message <path>`, адаптер вставляет этот флаг автоматически и читает ответ из файла, даже если stdout шумный.

## Установка

```bash
npm install -g @openai/codex
codex login                     # либо OPENAI_API_KEY для headless
codex exec "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=codex
CODEX_COMMAND="codex exec"
AGENT_PROJECT_CONTEXT="Что делаем, что уже решено."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE` не используется (Codex `exec` stateless).

## Захват вывода

Для Codex адаптер:

1. Создаёт временный путь `verbalcoding-codex-last-<pid>-<ts>.txt` в `os.tmpdir()`.
2. Вставляет `--output-last-message <path>` прямо перед последним позиционным аргументом.
3. После запуска читает этот файл как авторитетный ответ (приоритетнее stdout).
4. Удаляет временный файл.

Даже если Codex льёт tool-use в stdout, в голос идёт ответ из захваченного файла.

## Голосовые фразы для переключения на Codex

- en: `"switch to Codex"`, `"ask Codex what it thinks"`
- ru: `"переключись на Codex"`, `"спроси Codex"`

## Подводные камни

- **Долгие задачи.** Ставьте `AGENT_TASK_TIMEOUT_MS=0` под кодогенерацию на минуты. `signal.aborted` уважается — barge-in режет чисто.
- **Нет возобновления.** Передавайте контекст через `AGENT_PROJECT_CONTEXT`, после смены маршрута — блок hand-off.
- **Защита от patch-вывода.** Если turn прерван во время diff, мост не зачитывает diff и отправляет в текстовый канал.
- **Авторизация.** 401 идёт как non-zero exit; fallback на дефолт, если Codex не был дефолтом.
