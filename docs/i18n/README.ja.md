# VerbalCoding ドキュメント

<p align="center"><a href="../../README.md">English README</a> · <a href="../../README.ko.md">한국어</a> · <a href="../../README.ja.md">日本語</a> · <a href="../../README.zh.md">中文</a> · <a href="../../README.es.md">Español</a> · <a href="../../README.fr.md">Français</a> · <a href="../../README.ru.md">Русский</a></p>

README は短い入口で、このページは詳細ガイドの索引です。初めて実際の Discord voice bot を設定する場合は Fresh Install から始めてください。

## 最短経路

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## ガイド

| ガイド | 必要になる場面 |
|---|---|
| [Fresh Install](FRESH_INSTALL.ja.md) | クリーンな npm/global install、Discord app setup、初回 bot invite、初回 voice run。 |
| [Usage](USAGE.ja.md) | CLI コマンド、Discord コマンド、実行モード、voice changes、progress、latency metrics。 |
| [Hermes 標準音声 vs VerbalCoding](HERMES_VOICE.ja.md) | Hermes の Discord 標準音声がすでにできることと、VerbalCoding が加えるもの。 |
| [Configuration](CONFIGURATION.ja.md) | .env、agent backends、MCP server、TTS backends、運用設定。 |
| [Troubleshooting](TROUBLESHOOTING.ja.md) | Docker UDP、voice join failures、missing token/channel checks、doctor behavior。 |
| [Multi-Instance](MULTI_INSTANCE.ja.md) | 分離 Hermes profile でプロジェクト room ごとに固定 Discord voice bot を 1 つ。 |
| [Release Notes](RELEASE.ja.md) | 現在の機能、verification checklist、public-release 前の TODO。 |

## ローカライズ README

- [README.ja.md](../../README.ja.md)
- [English README](../../README.md)

## コントリビューター向けメモ

ユーザー向けドキュメントでは `vc ...` コマンドを優先し、`./scripts/...` は source checkout の contributor flow に限定してください。
