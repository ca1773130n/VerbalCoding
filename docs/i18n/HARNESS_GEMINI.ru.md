# Gemini CLI — Заметки по harness

<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="HARNESSES.ru.md">Harness-ы</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Настройка</a>
</p>

Gemini CLI — терминальный кодинг-агент Google. VerbalCoding вызывает его через `gemini -p`. Один turn — один вызов; возобновления между вызовами нет.

## Установка

Следуйте официальному гайду, затем проверьте:

```bash
gemini -p "hello"
```

## Настройка

```bash
# .env
AGENT_BACKEND=gemini
GEMINI_COMMAND="gemini -p"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Голосовые фразы для переключения на Gemini

- en: `"switch to Gemini"`, `"ask Gemini ..."`, `"switch to Gemini CLI"`
- ru: `"переключись на Gemini"`, `"спроси Gemini"`

Алиасы: `gemini`, `gemini cli`, `gemini-cli`.

## Подводные камни

- **Нет возобновления.** Та же стратегия, что у Claude/Codex: `AGENT_PROJECT_CONTEXT` + блок hand-off.
- **Длинные ответы.** Gemini иногда возвращает большие структуры; sentencer режет их на TTS-фразы. Код-блоки убираются из голоса (в текстовом канале остаются).
- **API key.** Ошибка авторизации — non-zero exit; fallback на дефолт, если Gemini не был дефолтом.
- **Подробный прогресс.** У Gemini нет превью в стиле `┊` Hermes — прогресс в основном даёт LLM-сводщик.
