# VerbalCoding 文档

<p align="center"><a href="../../README.md">English README</a> · <a href="../../README.ko.md">한국어</a> · <a href="../../README.ja.md">日本語</a> · <a href="../../README.zh.md">中文</a> · <a href="../../README.es.md">Español</a> · <a href="../../README.fr.md">Français</a> · <a href="../../README.ru.md">Русский</a></p>

README 是精简入口；本页是详细指南索引。第一次设置真实 Discord 语音 bot 时，请从 Fresh Install 开始。

## 最快路径

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## 指南

| 指南 | 适用场景 |
|---|---|
| [Fresh Install](FRESH_INSTALL.zh.md) | 干净的 npm/global install、Discord app setup、首次 bot invite、首次 voice run。 |
| [Usage](USAGE.zh.md) | CLI 命令、Discord 命令、运行模式、voice changes、progress、latency metrics。 |
| [Configuration](CONFIGURATION.zh.md) | .env、agent backends、MCP server、TTS backends、运维设置。 |
| [Troubleshooting](TROUBLESHOOTING.zh.md) | Docker UDP、voice join failures、missing token/channel checks、doctor behavior。 |
| [Multi-Instance](MULTI_INSTANCE.zh.md) | 使用隔离 Hermes profile，让每个项目房间拥有一个固定 Discord voice bot。 |
| [Release Notes](RELEASE.zh.md) | 当前功能、verification checklist、public-release 前 TODO。 |

## 本地化 README

- [README.zh.md](../../README.zh.md)
- [English README](../../README.md)

## 贡献者说明

面向用户的文档优先使用 `vc ...` 命令；`./scripts/...` 仅用于 source checkout 的贡献者流程。
