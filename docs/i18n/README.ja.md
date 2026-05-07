# VerbalCoding

<p align="center">
  <strong>Discord音声でCLIコーディングエージェントと通話するように作業できます。</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20Supertonic%20%7C%20SpeechSwift-0EA5E9">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCodingはDiscordの音声チャンネルを、コーディングエージェントのハンズフリー操作面に変えます。声で依頼し、CLIエージェントに作業させ、要点だけを音声で受け取れます。テキスト記録、進捗イベント、コードやログを読み上げすぎないガードも備えています。

## ハイライト

| できること | うれしい理由 |
|---|---|
| 音声ファーストのAgent操作 | Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw、カスタムCLIを声で操作できます。 |
| ローカル優先の音声ループ | Discord音声キャプチャ → `whisper.cpp` STT → Agent → 分割TTS再生。 |
| 音声とテキストの共有コンテキスト | 対応Agentでは音声ターンと`!ask`テキストコマンドが同じセッションを再利用できます。 |
| 割り込みと感度モード | 再生中に自然に割り込み、通常/保守的な感度を切り替えられます。 |
| 多言語音声プリセット | `vc language ko/en/auto`でSTT、進捗言語、TTS音声をまとめて変更できます。 |
| プロジェクト別マルチルーム分離 | プロジェクトごとにBot、Hermesプロファイル、セッション、メモリ、ログを分離します。 |

## クイックスタート

```bash
git clone git@github.com:ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
vc doctor
./run.sh
```

## 仕組み

```mermaid
flowchart LR
  A[Discord voice] --> B[@discordjs/voice]
  B --> C[PCM cleanup + gates]
  C --> D[whisper.cpp STT]
  D --> E[CLI agent adapter]
  E --> F[Concise answer]
  F --> G[Chunked TTS]
  G --> H[Discord playback]
```

## 対応エージェントバックエンド

| Backend | Default command | Session support |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Resume, verbose progress, cancellation, final-answer recovery |
| Claude Code / Claude CLI | `claude -p` | CLI session file support through adapter defaults |
| Codex CLI | `codex exec` | CLI session file support through adapter defaults |
| Gemini CLI | `gemini -p` | CLI session file support through adapter defaults |
| OpenCode | `opencode run` | CLI session file support through adapter defaults |
| OpenClaw | `openclaw run` | CLI session file support through adapter defaults |
| Custom | `AGENT_COMMAND` | Bring your own non-interactive command |

## 詳しく見る

| Guide | What you get |
|---|---|
| [Fresh Install](../FRESH_INSTALL.md) | クリーンなクローンからのセットアップ、モデル取得、初回起動 |
| [Usage Guide](../USAGE.md) | CLIコマンド、Discordコマンド、進捗モード、レイテンシ指標 |
| [Configuration](../CONFIGURATION.md) | .env、エージェントバックエンド、MCP、TTSバックエンド、運用メモ |
| [Multi-Instance](../MULTI_INSTANCE.md) | プロジェクトごとに常駐Discord音声ルームを用意 |
| [Release Notes](../RELEASE.md) | 現在の機能とリリース前チェックリスト |

## 小さなコマンド表

```bash
vc status
vc language ko|en|auto
vc bot invite CLIENT_ID
vc instance setup NAME
vc instance start NAME
vc doctor
```

## 要件

| Layer | Default |
|---|---|
| Runtime | Node.js 20+, npm |
| Audio | `ffmpeg` |
| STT | `whisper.cpp` / `whisper-cli` |
| Discord | Bot token, Message Content intent, voice permissions |
| Agent | At least one authenticated CLI harness, Hermes Agent by default |
| Platform focus | macOS / Apple Silicon currently gets the most testing |

## コントリビュート

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

## ステータス

VerbalCoding is public-release oriented but still early. Demo video/GIF, broader Linux notes, and a formal license file are still TODOs.
