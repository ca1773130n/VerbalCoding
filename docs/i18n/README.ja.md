# VerbalCoding

<p align="center">
  <strong>Discord 音声で CLI コーディングエージェントに話しかける — ソフトウェア作業のための電話のように。</strong>
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
  <img alt="Agents" src="https://img.shields.io/badge/Agents-Hermes%20%7C%20Claude%20%7C%20Codex%20%7C%20Gemini%20%7C%20OpenCode-111827">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding の音声からエージェントへのフロー" width="860">
</p>

## なぜ使うのか

VerbalCoding は、Discord の音声チャンネルをコーディングエージェント向けのハンズフリー操作面に変えます。リクエストを話し、CLI エージェントに作業を任せ、簡潔な回答を音声で受け取れます。テキスト文字起こし、進捗イベント、ノイズの多いコード/ログ出力に対するガードレールも備えています。

## ハイライト

| 得られるもの | 何がうれしいか |
|---|---|
| 音声ファーストのエージェント操作 | Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw、または任意のカスタム CLI ハーネスに話しかけられます。 |
| オンデバイスの音声ループ | Discord 音声キャプチャ → ローカル `whisper-cli` 文字起こし → エージェント → 分割 TTS 再生。 |
| 音声 + テキストの共有コンテキスト | 音声ターンと `!ask` テキストコマンドで、対応する同じエージェントセッションを再利用できます。 |
| 割り込み発話と感度モード | 再生を自然に中断し、通常環境と保守的/騒音環境向けのモードを切り替えられます。 |
| 多言語音声プリセット | `vc language ko/en/auto` で STT、進捗言語、TTS 音声をまとめて切り替えます。 |
| 複数ルームのプロジェクト分離 | プロジェクトルームごとに 1 つのボットを実行し、Hermes プロファイル、セッション、メモリ、ログを分離します。 |

## クイックスタート

npm を使う最短手順:

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

永続的なグローバルインストールなしで直接実行する場合:

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

コントリビューター向けの GitHub クローン手順:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes` と `./scripts/install.sh --yes` は、可能な範囲でローカル前提条件をブートストラップします。Node/npm 依存関係、`ffmpeg`、`whisper-cli`、デフォルトの whisper.cpp モデル、ローカル `.venv-tts` Edge TTS ヘルパー、クローンインストール用の短い `vc` シェルコマンドをセットアップします。macOS/Homebrew と一般的な Linux パッケージマネージャー（`apt`、`dnf`、`pacman`）をサポートします。依存関係だけをセットアップするには `--no-wizard` を付けて再実行し、OS パッケージを自分でインストールしたい場合は `--skip-system` を使います。

クリーンインストールの手順が必要ですか？ [新規インストール](FRESH_INSTALL.ja.md) から始めてください。

## 対応エージェントバックエンド

| バックエンド | デフォルトコマンド | セッション対応 |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | 再開、詳細な進捗、キャンセル、最終回答の復元 |
| Claude Code | `claude -p` | アダプターのデフォルトによる CLI セッションファイル対応 |
| Codex CLI | `codex exec` | アダプターのデフォルトによる CLI セッションファイル対応 |
| Gemini CLI | `gemini -p` | アダプターのデフォルトによる CLI セッションファイル対応 |
| OpenCode | `opencode run` | アダプターのデフォルトによる CLI セッションファイル対応 |
| OpenClaw | `openclaw run` | アダプターのデフォルトによる CLI セッションファイル対応 |
| Custom | `AGENT_COMMAND` | 独自の非対話コマンドを持ち込めます |

## さらに詳しく

| ガイド | 内容 |
|---|---|
| [新規インストール](FRESH_INSTALL.ja.md) | クリーンなクローンセットアップ、モデルのダウンロード、初回実行 |
| [使い方ガイド](USAGE.ja.md) | CLI コマンド、Discord コマンド、進捗モード、レイテンシ指標 |
| [設定](CONFIGURATION.ja.md) | `.env`、エージェントバックエンド、MCP、TTS バックエンド、運用メモ |
| [マルチインスタンス](MULTI_INSTANCE.ja.md) | プロジェクトごとに 1 つの永続 Discord 音声ルーム |
| [リリースノート](RELEASE.ja.md) | 現在の機能とプレリリースチェックリスト |

## 小さなコマンドマップ

```bash
vc status                 # 現在の言語、TTS、ブリッジ設定
vc language ko|en|auto    # STT/進捗/TTS の言語プリセットを切り替え
vc bot invite CLIENT_ID   # Discord ボット招待 URL を生成
vc instance setup NAME    # 分離されたプロジェクト音声ボットを作成
vc instance start NAME    # そのボットをバックグラウンドで実行
vc doctor                 # 秘密情報を伏せたヘルスチェック
vc start                  # デフォルトブリッジを起動
```

Discord 内:

| コマンド | 動作 |
|---|---|
| `!join` | 現在の音声チャンネルに参加します。 |
| `!ask <prompt>` | 同じエージェントバックエンドにテキストを送信します。 |
| `!verbose on\|off` | 短い進捗更新を表示/読み上げします。 |
| `!latency` | 直近の音声/STT/エージェント/TTS レイテンシを要約します。 |
| `!sensitivity normal` | 通常の屋内向け割り込み感度を使います。 |
| `!sensitivity conservative` | 騒音/屋外向けのより厳しい感度を使います。 |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | プロジェクトセッションを音声ルームに紐付けます。 |

## 要件

| レイヤー | デフォルト |
|---|---|
| ランタイム | Node.js 20+、npm。インストールスクリプトは Homebrew/apt/dnf/pacman 経由で導入できます |
| 音声 | `ffmpeg`。インストールスクリプトで導入できます |
| 音声認識 | whisper.cpp のローカル `whisper-cli`。インストールスクリプトは macOS では Homebrew、Linux ではローカルビルドのフォールバックを使います |
| TTS | Edge TTS CLI。必要に応じてインストールスクリプトが `.venv-tts` を作成します |
| Discord | ボットトークン、Message Content intent、音声権限 |
| エージェント | 認証済み CLI ハーネスが少なくとも 1 つ。デフォルトは Hermes Agent |
| 主な対象プラットフォーム | macOS / Apple Silicon で最も検証済み。Linux ブートストラップはベストエフォートで文書化されています |

## コントリビュート

変更を送る前に軽量チェックを実行してください:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

## ステータス

VerbalCoding は公開リリースを目指していますが、まだ初期段階です。デモ動画/GIF、より広範な Linux 検証、CI、より深いセキュリティレビューはまだ TODO です。
