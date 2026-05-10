# VerbalCoding

<p align="center"><strong>Discord 音声で CLI コーディングエージェントと電話のように作業します。</strong></p>

<p align="center">[English](../../README.md) · [한국어](README.ko.md) · [中文](README.zh.md) · [Español](README.es.md) · [Français](README.fr.md) · [Русский](README.ru.md)</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding は Discord のボイスチャンネルを、コーディングエージェント用のハンズフリー操作面にします。話して依頼し、CLI エージェントに作業させ、結果を音声とテキストで受け取れます。

## ハイライト

| 機能 | 利点 |
|---|---|
| 音声中心のエージェント制御 | Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw、または custom CLI を Discord 音声で操作できます。 |
| Guided setup | 手動で `.env` を編集する代わりに、`vc setup token` と `vc setup channels` でトークンと自動参加する音声チャンネルを保存します。 |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | `Cannot perform IP discovery - socket closed` が出る場合、チャンネルは見つかっていますが Discord 音声の UDP 検出に失敗しています。Linux Docker では `network_mode: "host"` を使い、同じサービスの `ports:` を削除してください。 |

## クイックスタート

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

## Discord 設定

```bash
vc bot invite <discord-client-id>
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## 小さなコマンド表

```bash
vc setup --yes                         # bootstrap prerequisites and starter config
vc setup token                         # save/update Discord bot token
vc setup channels "General,Team Voice" # save auto-join voice channel names
vc bot invite CLIENT_ID                 # generate Discord invite URL
vc doctor                               # redacted health check and supported auto-fixes
vc start                                # start the default bridge
vc instance setup NAME                  # create isolated project bot config
vc instance start NAME                  # run that bot in the background
```

## Docker / コンテナの注意

`Cannot perform IP discovery - socket closed` が出る場合、チャンネルは見つかっていますが Discord 音声の UDP 検出に失敗しています。Linux Docker では `network_mode: "host"` を使い、同じサービスの `ports:` を削除してください。

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

## 詳しく見る

| ガイド | リンク |
|---|---|
| Fresh install | [FRESH_INSTALL](FRESH_INSTALL.ja.md) |
| Usage | [USAGE](USAGE.ja.md) |
| Configuration | [CONFIGURATION](CONFIGURATION.ja.md) |
| Troubleshooting | [TROUBLESHOOTING](TROUBLESHOOTING.ja.md) |
| Multi-instance | [MULTI_INSTANCE](MULTI_INSTANCE.ja.md) |
