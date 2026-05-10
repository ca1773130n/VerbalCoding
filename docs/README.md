# VerbalCoding docs

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="./i18n/README.ko.md">한국어</a> ·
  <a href="./i18n/README.ja.md">日本語</a> ·
  <a href="./i18n/README.zh.md">中文</a> ·
  <a href="./i18n/README.es.md">Español</a> ·
  <a href="./i18n/README.fr.md">Français</a> ·
  <a href="./i18n/README.ru.md">Русский</a>
</p>

This is the detailed manual behind the compact README. Start with the fresh install guide if you are setting up a real Discord voice bot for the first time.

## Fast path

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## Guides

| Guide | Use it when you need |
|---|---|
| [Fresh Install](FRESH_INSTALL.md) | A clean npm/global install, Discord app setup, first bot invite, and first voice run. |
| [Usage](USAGE.md) | CLI commands, Discord commands, run modes, voice changes, progress, and latency metrics. |
| [Configuration](CONFIGURATION.md) | `.env`, agent backends, MCP server, TTS backends, and operational settings. |
| [Troubleshooting](TROUBLESHOOTING.md) | Docker UDP, voice join failures, missing token/channel checks, and doctor behavior. |
| [Multi-Instance](MULTI_INSTANCE.md) | One permanent Discord voice bot per project room with isolated Hermes profiles. |
| [Release Notes](RELEASE.md) | Current capabilities, verification checklist, and pre-public-release gaps. |

## Localized guide sets

| Language | Docs index |
|---|---|
| Korean | [docs/i18n/README.ko.md](i18n/README.ko.md) |
| Japanese | [docs/i18n/README.ja.md](i18n/README.ja.md) |
| Chinese | [docs/i18n/README.zh.md](i18n/README.zh.md) |
| Spanish | [docs/i18n/README.es.md](i18n/README.es.md) |
| French | [docs/i18n/README.fr.md](i18n/README.fr.md) |
| Russian | [docs/i18n/README.ru.md](i18n/README.ru.md) |

## Contributor note

Use `vc ...` commands in user-facing docs. Keep `./scripts/...` commands for source-checkout contributor flows only.
