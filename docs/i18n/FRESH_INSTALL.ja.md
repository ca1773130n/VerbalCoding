# 新規インストール

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="README.ja.md">ドキュメントハブ</a> ·
  <a href="FRESH_INSTALL.ja.md">Fresh Install</a> ·
  <a href="USAGE.ja.md">Usage</a> ·
  <a href="CONFIGURATION.ja.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.ja.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.ja.md">Multi-Instance</a>
</p>

> 最短経路: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

## 最新の setup フロー

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

手動で `.env` を編集せず、`vc setup token` で `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`、`vc setup channels` で `AUTO_JOIN_VOICE_CHANNELS` を保存してください。Docker で `Cannot perform IP discovery - socket closed` が出る場合、Linux Compose サービスに `network_mode: "host"` を使い、`ports:` を削除します。

このガイドは、クリーンな公開インストール向けです。ローカル環境だけに依存する前提を避け、インストーラーで可能な限りブートストラップします。

## 1. CLI をインストールする

推奨 npm 手順:

```bash
npm install -g verbalcoding
```

または公開パッケージを直接実行します:

```bash
npx verbalcoding setup --yes
```

`npm install -g` を使った場合は、続けて次を実行します:

```bash
vc setup
```

コントリビューター向けの GitHub クローン手順:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. 依存関係をブートストラップし、セットアップウィザードを実行する

npm インストールでは、現在のディレクトリにリポジトリのチェックアウトがないため、`./scripts/install.sh` を直接実行しないでください。代わりにパッケージ済み CLI ラッパーを使います:

```bash
vc setup
```

`vc setup` は、インストール済み npm パッケージ内の `scripts/install.sh` を実行します。`./scripts/install.sh --yes` は GitHub クローン内にいる場合だけ使ってください:

```bash
./scripts/install.sh --yes
```

実行される内容:

- `node_modules/` がない場合に npm 依存関係をインストールします。
- `npm link` で短い `vc` シェルコマンドをインストールします。
- OS パッケージマネージャーが対応している場合、`ffmpeg`、Node/npm、`whisper-cli` をインストールします。
- `models/ggml-small-q5_1.bin` をダウンロードします。
- `edge-tts` がまだ `PATH` にない場合、`.venv-tts` を作成して `edge-tts` をインストールします。
- 対話式 `.env` ウィザードを実行します。

対応するシステムブートストラップ手順:

| OS | システム依存関係の導入方法 |
|---|---|
| macOS | Homebrew: 必要に応じて `brew install node ffmpeg whisper-cpp` |
| Debian/Ubuntu | Node/npm、ffmpeg、Python、ビルドツールは `apt-get`。ローカル whisper.cpp ビルドにフォールバック |
| Fedora/RHEL | Node/npm、ffmpeg、Python、ビルドツールは `dnf`。ローカル whisper.cpp ビルドにフォールバック |
| Arch | Node/npm、ffmpeg、Python、ビルドツールは `pacman`。ローカル whisper.cpp ビルドにフォールバック |

便利なインストーラーのバリエーション:

```bash
vc setup --yes --no-wizard                   # npm インストールから依存関係/ブートストラップのみ
./scripts/install.sh --yes --no-wizard       # クローンから依存関係/ブートストラップのみ
./scripts/install.sh --skip-system           # OS パッケージをインストールしない
./scripts/install.sh --skip-model            # デフォルト STT モデルをダウンロードしない
./scripts/install.sh --skip-edge-tts         # .venv-tts を作成しない
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

OS が未対応の場合は、再実行する前に次を手動でインストールしてください:

- Node.js 20+ と npm
- ffmpeg
- venv/pip 付き Python 3
- whisper.cpp の `whisper-cli`
- 認証済み CLI エージェントバックエンドを少なくとも 1 つ（デフォルトは Hermes Agent）

## 3. Discord アプリケーションをセットアップする

初めてボットを作る場合は、まず上流の Discord ボットセットアップガイドを読んでください:

- Hermes Agent の Discord メッセージングガイド: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 公式ボット概要: <https://docs.discord.com/developers/bots/overview>
- Discord 公式はじめにガイド: <https://docs.discord.com/developers/quick-start/getting-started>

これらのページでは、Discord アプリケーションの作成、ボットユーザーの追加、特権インテントの有効化、サーバーへの招待方法を説明しています。VerbalCoding は同じ Discord ボット設定を使い、その上に音声受信、STT、CLI エージェント実行、TTS 再生を追加します。

1. Discord Developer Portal で Discord アプリケーションとボットを作成します。
2. Message Content 特権インテントを有効にします。
3. ボットトークンをインストーラーのプロンプト、または `.env` の `DISCORD_BOT_TOKEN` にコピーします。
4. 招待 URL を生成します:

```bash
vc bot invite <discord-client-id>
# または 1 つのサーバーに固定します:
vc bot invite <discord-client-id> --guild <guild-id>
```

この招待には、VerbalCoding が使うボットおよびスラッシュコマンドのスコープと、テキスト/音声権限が含まれます。

## 4. 検証する

```bash
vc doctor
```

`vc doctor` は秘密情報を伏せます。トークン/コマンド/モデルの欠落を、秘密値を出力せずに報告します。修復可能なローカル前提条件（`ffmpeg`、`whisper-cli`、デフォルトモデル、Edge TTS ヘルパー）が欠けている場合は、まずパッケージ済みブートストラップを自動的に再実行します。残った `✗` 項目を修正してから再実行してください。

期待される成功例:

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

インストーラーがローカル Edge TTS ヘルパーを作成した場合、`.env` には `.venv-tts/bin/edge-tts` を指す `EDGE_TTS_COMMAND` パスが含まれているはずです。

## 5. 単一のデフォルトボットを実行する

```bash
vc start
# または GitHub クローンから:
./run.sh
```

起動に成功すると、ログには次のような行が含まれます:

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

Discord 内:

```text
!ping
!join
!ask say hello briefly
!verbose on
```

その後、設定済みの音声チャンネルで話してください。STT テキスト、詳細モードがオンの場合の進捗テキスト、最終テキスト回答が表示され、TTS 再生が聞こえるはずです。

## 6. プロジェクトごとのルーム設定

プロジェクト音声ルームごとに 1 つの永続ボットを使うには、プロジェクトごとに Discord アプリケーションを 1 つ作成してから、次を実行します:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

各インスタンスは、独自のトークン、音声チャンネル、文字起こし先、ログパス、Hermes セッションファイル、任意の Hermes プロファイルを含む、git で無視される `instances/<name>.env` を書き込みます。

## 7. 任意の OpenVoice セットアップ

OpenVoice の音声クローンは任意です。新規の公開インストールでは `TTS_BACKEND=edge` のままにしてください。後で OpenVoice を有効にするには:

```bash
./scripts/setup_openvoice.sh
# OpenVoice V2 checkpoints を vendor/OpenVoice/checkpoints_v2/ にダウンロードします
# 許可済みのローカルサンプルを voice-samples/user-reference.wav に追加するか、
# ボットを実行して「목소리 샘플 녹음 시작해」と言い、その後 10〜30 秒話します。
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

次に `TTS_BACKEND=openvoice` を設定し、`vc doctor` を実行して、Discord で `!voice-test <text>` をテストします。

## 8. メンテナー向けクリーンクローンのスモークテスト

ホストのみでの高速スモークテスト:

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

この時点で期待される失敗は、ローカル秘密情報の欠落またはエージェント CLI が未認証であることです。トークン漏えいやインストールスクリプトの欠落ではありません。

Docker ベースの Ubuntu クリーンインストールスモークテスト:

```bash
./scripts/docker_ubuntu_smoke.sh
```

これは `ubuntu:24.04` を実行し、追跡対象のリポジトリツリーをクリーンなコンテナへコピーし、`./scripts/install.sh --yes --no-wizard` を実行し、秘密情報を含まないスモーク用 `.env` を書き、`vc` を確認し、Node テストを実行して、`vc doctor` を検証します。Discord 音声には接続しません。エンドツーエンドの音声チャンネルテストが必要な場合は、この後で実際の Ubuntu VM または WSL2 を使ってください。
