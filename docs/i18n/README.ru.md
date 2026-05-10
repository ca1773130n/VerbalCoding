# Документация VerbalCoding

<p align="center"><a href="../../README.md">English README</a> · <a href="../../README.ko.md">한국어</a> · <a href="../../README.ja.md">日本語</a> · <a href="../../README.zh.md">中文</a> · <a href="../../README.es.md">Español</a> · <a href="../../README.fr.md">Français</a> · <a href="../../README.ru.md">Русский</a></p>

README — краткая витрина; эта страница — индекс подробных гайдов. Если вы впервые настраиваете реальный Discord voice bot, начните с Fresh Install.

## Быстрый путь

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## Гайды

| Гайды | Когда использовать |
|---|---|
| [Fresh Install](FRESH_INSTALL.ru.md) | чистый npm/global install, Discord app setup, первый bot invite и первый voice run. |
| [Usage](USAGE.ru.md) | CLI-команды, Discord-команды, режимы запуска, voice changes, progress и latency metrics. |
| [Configuration](CONFIGURATION.ru.md) | .env, agent backends, MCP server, TTS backends и эксплуатационные настройки. |
| [Troubleshooting](TROUBLESHOOTING.ru.md) | Docker UDP, voice join failures, missing token/channel checks и doctor behavior. |
| [Multi-Instance](MULTI_INSTANCE.ru.md) | один постоянный Discord voice bot на проектную room с изолированными Hermes profiles. |
| [Release Notes](RELEASE.ru.md) | текущие возможности, verification checklist и TODO перед public release. |

## Локализованный README

- [README.ru.md](../../README.ru.md)
- [English README](../../README.md)

## Заметка для contributors

В пользовательских docs предпочитайте команды `vc ...`. Команды `./scripts/...` оставляйте для contributor flow из source checkout.
