# VerbalCoding

<p align="center"><strong>Discord 音声で CLI コーディングエージェントと電話のように作業できます。</strong></p>

<p align="center"><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.zh.md">中文</a> · <a href="./README.es.md">Español</a> · <a href="./README.fr.md">Français</a> · <a href="./README.ru.md">Русский</a></p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20SpeechSwift-0EA5E9">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## なぜ作ったのか

VerbalCoding は Discord の音声ルームを、コーディングエージェント用のハンズフリー操作席に変えます。声で依頼し、CLI エージェントに作業させ、短い音声回答とテキスト記録を受け取れます。diff やログを長々と読み上げないための保護も入っています。

## 体験の違い

| 機能 | 価値 |
|---|---|
| 電話のような流れ | 同じ Discord 音声チャンネルで話す、聞く、割り込む、続けるができます。 |
| 人向けのガイド付き設定 | `vc setup` が prerequisites、Discord token/client ID、voice channel、transcript target、backend、TTS 設定を一連の流れで確認します。 |
| ローカル音声ループ | Discord audio → local `whisper-cli` → selected CLI agent → TTS response。 |
| エージェント選択 | Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw、custom command に対応します。 |
| 運用向け機能 | doctor auto-fix、Docker UDP ガイド、latency metrics、multi-instance rooms、redacted config checks を備えています。 |

## クイックスタート

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

通常の人間向け導線は `vc setup` です。Discord Developer Portal を開いたまま、bot token、application/client ID、transcript target、voice channel names を入力してください。

自動化ではプロンプトを省略し、Discord の値を後から設定できます。

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

## Discord 設定を 1 分で

1. Discord Developer Portal で application と bot を作成します。
2. Message Content privileged intent を有効にします。
3. `vc setup` を実行し、bot token と application/client ID を貼り付けます。
4. 自動参加する voice channel 名を正確に入力します。
5. 次のコマンドで bot を招待します。

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## 小さなコマンド表

```bash
vc setup                                 # ガイド付き設定: prerequisites, Discord, backend, voice
vc setup --yes                           # 非対話 bootstrap/starter config
vc setup token                           # Discord bot token と client ID を後で更新/追加
vc setup channels "General,Team Voice"   # auto-join voice channel names を更新
vc bot invite CLIENT_ID                  # Discord bot invite URL を生成
vc status                                # 現在の設定を表示
vc language ko|en|auto                   # language preset を切り替え
vc doctor                                # redacted health check と auto-fix
vc start                                 # 既定 bridge を開始
vc instance setup NAME                   # 分離された project voice bot を作成
vc instance start NAME                   # その bot を background で実行
```

## 詳しく見る

| ガイド | 得られる内容 |
|---|---|
| [ドキュメントハブ](docs/i18n/README.ja.md) | ローカライズ済みガイドの索引。 |
| [Fresh Install](docs/i18n/FRESH_INSTALL.ja.md) | npm/global setup、Discord 設定、初回起動。 |
| [Usage](docs/i18n/USAGE.ja.md) | CLI コマンド、Discord コマンド、実行モード、latency。 |
| [Configuration](docs/i18n/CONFIGURATION.ja.md) | .env、agent backends、MCP、TTS、運用。 |
| [Troubleshooting](docs/i18n/TROUBLESHOOTING.ja.md) | Docker UDP、token/channel 不足チェック。 |
| [Multi-Instance](docs/i18n/MULTI_INSTANCE.ja.md) | プロジェクトごとに固定音声ルームを 1 つ。 |

## 要件

| レイヤー | 既定 |
|---|---|
| Runtime | Node.js 20+ と npm。 |
| Audio | `ffmpeg` と local `whisper-cli`。 |
| TTS | 既定は Edge TTS。OpenVoice、SpeechSwift/CosyVoice、Supertonic は任意。 |
| Discord | Bot token、Message Content intent、voice permissions、一致する channel names。 |
| Agent | 認証済み CLI harness が 1 つ以上。既定は Hermes Agent。 |

## Docker / コンテナ注意

ログに `Cannot perform IP discovery - socket closed` が出る場合、Discord voice UDP がブロックされています。Linux Docker Compose では次を使います:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

`network_mode: "host"` と `ports:` を併用しないでください。

## コントリビューション

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## 状態

VerbalCoding は公開リリースを目指していますが、まだ初期段階です。デモ動画/GIF、より広い Linux 検証、CI、セキュリティレビューは TODO です。
