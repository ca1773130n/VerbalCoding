# Встроенный голос Hermes vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.ru.md">README</a> ·
  <a href="README.ru.md">Центр документации</a> ·
  <a href="USAGE.ru.md">Использование</a> ·
  <a href="CONFIGURATION.ru.md">Конфигурация</a> ·
  <a href="TROUBLESHOOTING.ru.md">Диагностика</a>
</p>

> Hermes уже поддерживает голосовые каналы Discord. VerbalCoding не заменяет этот базовый цикл, а добавляет workflow-слой для работы с coding-агентами как по телефону.
<!-- /readme-glow-up:intro -->

## Что Hermes уже умеет

Discord gateway в Hermes Agent умеет работать с голосовыми каналами. Когда bot находится на сервере, команды `/voice join` или `/voice channel` подключают его к VC, где сейчас находится пользователь. Затем Hermes распознаёт речь через Whisper/STT и отвечает голосом через Edge TTS, ElevenLabs, OpenAI или другой настроенный TTS provider.

Для базового живого голосового чата этого уже достаточно:

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

## Что добавляет VerbalCoding

| Область | Встроенный голос Hermes | VerbalCoding |
|---|---|---|
| Цель | Обычный разговор с Hermes в Discord VC | Телефонный workflow для CLI coding-агентов |
| Команды | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, multi-instance команды |
| Backend | Hermes Agent | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw или custom command |
| Сессии | Обычная Hermes gateway session | Маршрутизация project/session, привязка VC, общий контекст голоса + `!ask` где backend это поддерживает |
| Голосовой UX | Базовые STT + TTS | Настроенные окна реплик, языковые пресеты, очистка transcript, text mirror, voice tests |
| Прерывания | Базовое поведение playback | Barge-in правила: остановить воспроизведение, не убив случайно активную agent task |
| Долгие задачи | Обычный ответ agent | Голосовой progress/status, verbose сводки tool-progress, защита от чтения diff/log через TTS |
| Операции | Настройка Hermes gateway | `vc doctor`, redacted diagnostics, latency metrics, Docker UDP guidance, multi-bot/project rooms |

## Что выбрать

Выбирайте **встроенный голос Hermes**, если нужен простой цикл “сказать → распознать → ответить → озвучить” в одном голосовом канале.

Выбирайте **VerbalCoding**, если нужен общий проектный контекст для голоса и текста, несколько CLI backend, корейские/английские пресеты, безопасные прерывания во время долгих задач, голосовой прогресс, latency metrics и операционные инструменты.

## Честное позиционирование

VerbalCoding не стоит описывать как “добавление Discord voice в Hermes с нуля”. У Hermes уже есть базовая функция. Точнее: VerbalCoding — это Discord voice workflow layer для CLI coding-агентов; он может использовать Hermes как backend по умолчанию и добавляет project routing, interruption semantics, progress UX, diagnostics и backend switching.
