# マルチインスタンス VerbalCoding

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

VerbalCoding は、複数の独立した Discord 音声ブリッジプロセスを実行できます。各プロセスは既存の単一インスタンス Node ブリッジのままですが、異なる `instances/<name>.env` ファイルを読み込み、異なる Discord ボットトークンを使います。

各プロジェクトが専用の Discord 音声チャンネルに常駐し、専用の文字起こしチャンネル/スレッドへ書き込む必要がある場合に使います。

## 複数のボットトークンが必要な理由

Discord 音声の常駐は、実質的に 1 つのギルドにつき 1 ボットアカウントあたり 1 つのアクティブな音声接続です。同じギルド内で 1 つのボットトークンが別の音声チャンネルに参加すると、以前のチャンネルに同時に常駐し続けることはできません。同時に使うプロジェクトルームには、プロジェクトごとに 1 つの Discord アプリケーション/ボットを作成してください。

## ファイルレイアウト

```text
instances/
  README.md
  example.env
  llm-wiki.env        # ローカルのみ、git で無視
  verbalcoding.env    # ローカルのみ、git で無視
.run/instances/
  llm-wiki.pid        # 実行時のみ、git で無視
```

実際の `instances/*.env` ファイルは Discord トークンを含む可能性があるため無視されます。`instances/example.env` がコミット済みテンプレートです。

## インスタンスセットアップウィザード

通常利用では、ユーザーが env ファイルをコピーして手動編集すべきではありません。代わりにウィザードを実行してください:

```bash
vc instance setup llm-wiki
# またはプロジェクトセットアップスクリプトから:
./scripts/install.sh --instance llm-wiki
```

ウィザードは、ボットトークン、Discord Application/Client ID、音声チャンネル、文字起こし先、作業ディレクトリ、プロジェクトコンテキスト、分離されたランタイムパスを尋ねます。`instances/<name>.env` をモード `0600` で書き込み、上書き前に既存ファイルをバックアップし、次に使う start/status コマンドを表示します。

セットアップ中に Discord Application/Client ID を入力すると、概要にそのボットの招待 URL も表示されます。同じ URL はいつでも次で生成できます:

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

同時に常駐する音声ルームごとに Discord Developer Portal のアプリケーション/ボットは依然として 1 つ必要ですが、OAuth URL や権限整数を手動で組み立てずに済みます。

### Hermes プロファイル分離

各インスタンスには `~/.hermes/profiles/<name>` に独自の Hermes ホームが与えられるため、メモリ、MEMORY.md、SOUL.md、学習済みスキルがプロジェクト間で漏れません。

`vc instance setup <name>` は自動的に次を行います:

- `hermes profile create <name> --clone-from default` を実行します（現在の `~/.hermes` から API キーとモデルを引き継ぎ、セッションとメモリは新規に開始します）。
- 新しいプロファイルの `terminal.cwd` をインスタンスの作業ディレクトリに設定します。
- ウィザードのプロジェクトコンテキスト回答から `<profile>/SOUL.md` を初期化します。
- `instances/<name>.env` に `HERMES_HOME=...` を書き込みます。

`vc instance start <name>` は自己修復します。env が指す Hermes プロファイルディレクトリが存在しない場合、起動前に再作成します。

Hermes は名前をディレクトリおよび設定キーとして使うため、インスタンス名は `^[a-z0-9][a-z0-9_-]{0,63}$` に一致する必要があります。

## 生成される最小インスタンス env

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

各インスタンスには、ログ/デバッグ/セッションファイル用に一意の値を与えてください。`HERMES_HOME` と対応する `~/.hermes/profiles/<name>` ディレクトリは `vc instance setup` によって自動作成されます。`vc doctor` は、重複トークン、衝突するランタイムパス、存在しないプロファイルディレクトリ、プロファイルとインスタンス間の `terminal.cwd` 不一致を、秘密情報を出力せずに確認します。

## コマンド

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start` は `./run.sh instances/<name>.env` をデタッチして実行し、`.run/instances/<name>.pid` を書き込みます。

`stop` は `SIGTERM` を送り、最大 10 秒待ってから `SIGKILL` にフォールバックし、pid ファイルを削除します。

## 例: 2 つの永続音声ルーム

1. 2 つの Discord アプリケーション/ボットを作成します:
   - VerbalCoding bot
   - LLM-Wiki bot

2. テキストおよび音声権限付きで両方をサーバーに招待します:
   - チャンネルを見る
   - メッセージを送信
   - スレッドでメッセージを送信
   - メッセージ履歴を読む
   - アプリケーションコマンドを使う
   - 接続
   - 発話

   各 Discord アプリケーション作成後に `vc bot invite <client-id>` を使うと、これらの権限を含む正確な招待 URL が出力されます。

3. 各ローカルインスタンスでセットアップウィザードを実行します:

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

ウィザードは、git で無視される `instances/verbalcoding.env` と `instances/llm-wiki.env` をモード `0600` で書き込みます。また、既存のインスタンス env を置き換える前にバックアップします。各実行では、デフォルト Hermes ホームから複製された `~/.hermes/profiles/<name>` も作成されるため、2 つのインスタンスは同じ認証/モデルで開始しながら、各プロジェクトの学習に伴って独立したメモリとスキルを蓄積します。

4. 設定を確認します:

```bash
vc doctor
```

5. 両方を起動します:

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. ログを確認します:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

期待されるログ行:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. 両方を停止します:

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## 短期的な単一ボットでのテキスト/音声紐付け

ボットトークンが 1 つしかない場合は、同時マルチチャンネル常駐ではなく、プロジェクトセッションの音声紐付けを使ってください。

対象のテキストチャンネル/スレッドで次を実行します:

```text
!session attach-voice --voice "LLM-Wiki"
```

動作:

- 選択した音声チャンネルを現在のテキストチャンネル/スレッドに紐付けます。
- 現在のテキストチャンネルにプロジェクトセッションがない場合、アドホックな分離セッションを作成します。
- 音声 STT/結果/進捗/最終回答テキストは、そのアクティブなプロジェクト文字起こし先へルーティングされます。

既存の名前付きプロジェクトセッションを紐付けるには:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

これはルーティングには便利ですが、1 つのボットを同時に 2 つの音声チャンネルへ常駐させるものではありません。同時に永続常駐させるには、複数のボットトークン/プロセスを使ってください。
