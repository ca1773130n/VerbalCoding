# Многоэкземплярный VerbalCoding


## Актуальный setup-процесс

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

Не редактируйте `.env` вручную: используйте `vc setup token` для `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` и `vc setup channels` для `AUTO_JOIN_VOICE_CHANNELS`. Если Docker показывает `Cannot perform IP discovery - socket closed`, в Linux Compose используйте `network_mode: "host"` и удалите `ports:`.

VerbalCoding может запускать несколько независимых процессов голосового bridge Discord. Каждый процесс всё ещё является существующим одноэкземплярным Node bridge, но загружает другой файл `instances/<name>.env` и использует другой токен Discord-бота.

Используйте это, когда каждый проект должен постоянно занимать собственный голосовой канал Discord и писать в собственный канал/тред расшифровок.

## Почему требуется несколько токенов ботов

Присутствие в голосе Discord фактически ограничено одним активным голосовым подключением на аккаунт бота в пределах guild. Если один токен бота подключается к другому голосовому каналу в той же guild, он не может одновременно оставаться постоянно подключённым к предыдущему каналу. Для одновременных проектных комнат создавайте по одному приложению/боту Discord на проект.

## Структура файлов

```text
instances/
  README.md
  example.env
  llm-wiki.env        # local only, ignored by git
  verbalcoding.env    # local only, ignored by git
.run/instances/
  llm-wiki.pid        # runtime only, ignored by git
```

Настоящие файлы `instances/*.env` игнорируются, потому что могут содержать токены Discord. `instances/example.env` — закоммиченный шаблон.

## Мастер настройки экземпляра

Пользователям не следует копировать и вручную редактировать env-файлы для обычного использования. Вместо этого запустите мастер:

```bash
vc instance setup llm-wiki
# or through the project setup script:
./scripts/install.sh --instance llm-wiki
```

Мастер запрашивает токен бота, Discord Application/Client ID, голосовой канал, цель расшифровок, workdir, контекст проекта и изолированные runtime-пути. Он записывает `instances/<name>.env` с режимом `0600`, создаёт резервную копию существующего файла перед перезаписью и печатает следующие команды start/status.

Если во время настройки вы введёте Discord Application/Client ID, сводка также напечатает URL приглашения для этого бота. Тот же URL можно сгенерировать в любое время:

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

Discord всё равно требует одно приложение/бота Developer Portal на каждую одновременную голосовую комнату, но это избавляет от ручной сборки OAuth URL или целых чисел разрешений.

### Изоляция профилей Hermes

Каждый экземпляр получает собственный home Hermes в `~/.hermes/profiles/<name>`, чтобы память, MEMORY.md, SOUL.md и изученные skills не перетекали между проектами.

`vc instance setup <name>` автоматически:

- запускает `hermes profile create <name> --clone-from default` (переносит API-ключи и модель из текущего `~/.hermes`; сессии и память начинаются заново),
- задаёт `terminal.cwd` нового профиля в workdir экземпляра,
- заполняет `<profile>/SOUL.md` из ответа мастеру о контексте проекта,
- записывает `HERMES_HOME=...` в `instances/<name>.env`.

`vc instance start <name>` самовосстанавливается: если env указывает на директорию профиля Hermes, которой больше нет, команда start пересоздаёт её перед запуском.

Имена экземпляров должны соответствовать `^[a-z0-9][a-z0-9_-]{0,63}$`, потому что Hermes использует имя как директорию и ключ конфигурации.

## Минимальный сгенерированный env экземпляра

```env
INSTANCE_NAME=my-project
DISCORD_TOKEN=replac...oken
DISCORD_CLIENT_ID=123456789012345678
AUTO_JOIN_VOICE_CHANNELS=Project Room
TRANSCRIPT_CHANNEL_ID=123456789012345678
PROJECT_SESSIONS_FILE=config/project-sessions.my-project.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-my-project.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-my-project-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/my-project.session
HERMES_HOME=/home/you/.hermes/profiles/my-project
AGENT_LABEL=VerbalCoding · My Project
AGENT_CWD=/path/to/my-project
AGENT_PROJECT_CONTEXT=Project session: My Project
```

Дайте каждому экземпляру уникальные значения для файлов логов/debug/session. `HERMES_HOME` и соответствующая директория `~/.hermes/profiles/<name>` создаются автоматически командой `vc instance setup`. `vc doctor` проверяет повторяющиеся токены, конфликтующие runtime-пути, отсутствующие директории профилей и несоответствия `terminal.cwd` между профилем и экземпляром — всё это без печати секретов.

## Команды

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start` запускает `./run.sh instances/<name>.env` в detached-режиме и записывает `.run/instances/<name>.pid`.

`stop` отправляет `SIGTERM`, ждёт до 10 секунд, затем откатывается к `SIGKILL` и удаляет pid-файл.

## Пример: две постоянные голосовые комнаты

1. Создайте два приложения/бота Discord:
   - бот VerbalCoding
   - бот LLM-Wiki

2. Пригласите обоих на сервер с текстовыми и голосовыми разрешениями:
   - Просмотр канала
   - Отправка сообщений
   - Отправка сообщений в тредах
   - Чтение истории сообщений
   - Использование команд приложения
   - Подключение
   - Речь

   Используйте `vc bot invite <client-id>` после создания каждого приложения Discord, чтобы напечатать точный URL приглашения с этими разрешениями.

3. Запустите мастер настройки для каждого локального экземпляра:

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

Мастер записывает игнорируемые файлы `instances/verbalcoding.env` и `instances/llm-wiki.env` с режимом `0600`; он также создаёт резервную копию существующего env экземпляра перед заменой. Каждый запуск также создаёт `~/.hermes/profiles/<name>`, клонированный из вашего стандартного Hermes home, поэтому два экземпляра стартуют с одинаковой аутентификацией/моделью, но накапливают независимую память и skills по мере изучения каждого проекта.

4. Проверьте конфигурацию:

```bash
vc doctor
```

5. Запустите оба:

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. Проверьте логи:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

Ожидаемые строки логов:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. Остановите оба:

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## Краткосрочная привязка текста/голоса с одним ботом

Если у вас есть только один токен бота, используйте привязку голоса проектной сессии вместо одновременного присутствия в нескольких каналах.

Выполните это в целевом текстовом канале/треде:

```text
!session attach-voice --voice "LLM-Wiki"
```

Поведение:

- Привязывает выбранный голосовой канал к текущему текстовому каналу/треду.
- Если в текущем текстовом канале нет проектной сессии, создаёт ad-hoc изолированную сессию.
- Текст voice STT/result/progress/final-answer направляется в активную цель расшифровок проекта.

Чтобы привязать существующую именованную проектную сессию:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

Это удобно для маршрутизации, но не заставляет одного бота одновременно оставаться в двух голосовых каналах. Для одновременного постоянного присутствия используйте несколько токенов/процессов ботов.
