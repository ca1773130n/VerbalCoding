# VerbalCoding リリースノート


## 最新の setup フロー

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

手動で `.env` を編集せず、`vc setup token` で `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`、`vc setup channels` で `AUTO_JOIN_VOICE_CHANNELS` を保存してください。Docker で `Cannot perform IP discovery - socket closed` が出る場合、Linux Compose サービスに `network_mode: "host"` を使い、`ports:` を削除します。

## 現在のリリース候補

VerbalCoding は、CLI ベースのコーディングエージェントを音声で操作するための Discord 音声ブリッジです。公開リリースを意識しており、最も検証されている経路は macOS / Apple Silicon です。一般的なパッケージマネージャー向けに、Linux のベストエフォートなブートストラップもサポートしています。

### 含まれるもの

- Node `@discordjs/voice` による Discord 音声受信。
- `whisper.cpp` + Metal によるローカル韓国語 STT。
- 韓国語デフォルト音声による Edge TTS 再生。
- 汎用 CLI ハーネスアダプターレイヤー:
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - カスタムコマンド
- Hermes バックエンド向けの共有音声/テキストセッション対応。
- 長い回答の TTS 分割と応答性の高い割り込み発話。
- 大きな技術出力を読み上げないための diff/code/log ガードレール。
- 屋内利用と騒音/屋外利用向けの通常および保守的な感度モード。
- セットアップウィザード、`.env.example`、`vc doctor` 前提条件チェッカー、OS パッケージ、npm 依存関係、Edge TTS ヘルパー、デフォルト whisper.cpp モデルをブートストラップする `./scripts/install.sh --yes`。
- npm パッケージのインストール手順: `npm install -g verbalcoding`、`vc setup --yes`、`vc start`。
- 長いエージェント作業中に、テキストのみの中間ステップ更新を出す任意の詳細進捗モード。
- パイプライン最適化のための常時オン JSONL レイテンシ指標と、`!latency` / `!metrics` 要約。
- より余裕のある発話アイドル待ち（`UTTERANCE_IDLE_MS=4500`）。自然な間を含む長い音声指示が、部分プロンプトと無視される処理中発話に分割されないようにします。
- マルチインスタンス Hermes プロファイル分離: `vc instance setup <name>` は、インスタンス作業ディレクトリ付きで Hermes プロファイルを `~/.hermes/profiles/<name>` に自動複製し、SOUL.md を初期化し、インスタンス env に `HERMES_HOME` を書き込みます。これによりプロジェクトごとのメモリとスキルを分離できます。`vc instance start` は欠落したプロファイルを自己修復し、`vc doctor` はプロファイルディレクトリの存在と `terminal.cwd` の整合性を確認します。

### プレリリースチェックリスト

リポジトリルートから実行してください:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # Docker が必要。ubuntu:24.04 のクリーンインストールを検証
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # Python テストが存在しない場合は OK
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

手動スモークテスト:

1. `vc start` または `./run.sh` でブリッジを起動します。
2. ログに `Logged in as <bot-name>` が含まれることを確認します。
3. ログに `Listening in voice channel ... / 일반` または設定済みのデフォルトチャンネルが含まれることを確認します。
4. Discord で `!ping` を実行します。
5. Discord 音声で短い韓国語リクエストを話します。
6. STT 文字起こし、エージェント応答、TTS 再生、割り込み発話の動作を確認します。

### 既知の要件

- ベストエフォートのブートストラップには、Homebrew 付き macOS、または `apt`、`dnf`、`pacman` 付き Linux が必要です。
- `ffmpeg`。インストーラーはこれのインストールを試みます。
- `whisper-cli`。インストーラーは macOS では Homebrew、Linux ではローカル `vendor/whisper.cpp` ビルドのフォールバックを使います。
- `models/ggml-small-q5_1.bin` にあるデフォルトモデル。`--skip-model` を使わない限り、インストーラーがダウンロードします。
- `PATH` 上の Edge TTS CLI、またはローカル `.venv-tts/bin/edge-tts`。必要な場合、インストーラーがローカルヘルパーを作成します。
- `.env`、`instances/<name>.env`、`~/.zshrc`、または実行時 env 内の Discord ボットトークン。
- 選択した CLI ハーネスがインストール済みで認証済みであること。

### まだ公開リリース向けではないもの

公開リリース前に、次の追加を検討してください:

- GitHub Actions CI。
- デモ動画 / GIF。
- Discord ボットセットアップのスクリーンショット。
- スクリプトレベルのチェックを超えた、実ディストリビューション上でのより広範な Linux 検証。
- すべてのログパスのセキュリティレビュー。
