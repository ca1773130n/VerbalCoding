# VerbalCoding 設定

## セットアップウィザード

Discord ボット/アプリケーションのセットアップ手順は、ここでは最初から説明し直しません。Discord 側の手順には次の上流ガイドを使い、その後 VerbalCoding のセットアップに戻ってください:

- Hermes Agent の Discord メッセージングガイド: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 公式ボット概要: <https://docs.discord.com/developers/bots/overview>
- Discord 公式クイックスタート: <https://docs.discord.com/developers/quick-start/getting-started>

```bash
./scripts/install.sh
```

インストーラーは、Discord トークン、許可ユーザー、自動参加する音声チャンネル名、文字起こし先チャンネル/スレッド、CLI ハーネスバックエンド、デフォルト音声言語、TTS 設定、ウェイクワード動作を尋ねます。モード `0600` で `.env` を書き込みます。`.env` は git で無視されます。また、短いシェルコマンド `vc` もリンクします。

手動インストール後にシェルコマンドだけが必要な場合:

```bash
npm link
```

## 対応エージェントバックエンド

`.env` で `AGENT_BACKEND` を設定します。

| バックエンド | デフォルトコマンド | メモ |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | デフォルト。`.verbalcoding-session` の再開動作を保持します。 |
| `claude-code` / `claude` | `claude -p` | `CLAUDE_COMMAND` または `AGENT_COMMAND` で上書きします。 |
| `codex` | `codex exec` | `CODEX_COMMAND` または `AGENT_COMMAND` で上書きします。 |
| `gemini` | `gemini -p` | `GEMINI_COMMAND` または `AGENT_COMMAND` で上書きします。 |
| `opencode` | `opencode run` | `OPENCODE_COMMAND` または `AGENT_COMMAND` で上書きします。 |
| `openclaw` | `openclaw run` | `OPENCLAW_COMMAND` または `AGENT_COMMAND` で上書きします。 |
| `custom` | 必須の `AGENT_COMMAND` | プロンプトは最後の argv 引数として追加されます。 |

汎用の上書き設定:

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=4500
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## エージェントアダプター契約

音声ブリッジは、すべてのバックエンドと 1 つのアダプター契約を通じてやり取りします:

- `run({ text }, signal, plan)` はステータス、最終回答テキスト、バックエンドラベル、経過時間、任意のセッションメタデータを返します。
- `ask(text, signal, plan)` は互換性用のショートカットで、最終回答テキストだけを返します。
- `capabilities` は、バックエンドがセッション再開、ストリーミング進捗、キャンセルをサポートするかを宣言します。
- Hermes は参照アダプターです。再開、詳細進捗ストリーミング、キャンセル、Hermes セッションファイルからの最終回答復元に対応します。

新しいバックエンドは同じ契約を実装し、音声/STT/TTS の動作はアダプター外に保つべきです。

## `.env` の例

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_female"
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="4500"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## TTS 音声選択

言語プリセットと音声選択は別のものです:

- `vc language ko|en|auto` は STT 言語、進捗言語、その言語のデフォルト音声を変更します。
- 「남자 한국어 목소리로 바꿔」「여자 한국어 목소리로 바꿔」、`change voice to Korean female`、`switch speaker to English` などのライブ音声コマンドは、話者/音声タイプだけを変更します。
- `!voice-test <text>` は、現在選択されているバックエンドと音声で短いサンプルを再生します。

音声選択はデフォルトで `config/tts-voices.json` に保存されます。パスは `TTS_VOICE_CONFIG` で上書きできます。実行中のブリッジは合成前に音声選択を再読み込み/適用するため、音声コマンドは完全な再起動なしで反映されます。

デフォルト Edge カタログ:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | 言語 |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | 韓国語 |
| `korean_female` | `ko-KR-SunHiNeural` | 韓国語 |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | 韓国語 |
| `english_male` | `en-US-GuyNeural` | 英語 |
| `english_female` | `en-US-AriaNeural` | 英語 |

永続的な手動上書き:

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

OpenVoice、SpeechSwift、Supertonic では、下のセクションにあるバックエンド固有の音声/参照設定を維持してください。同じ音声カタログファイルで有効な音声タイプを追跡することは可能です。

バックエンド固有の音声オプション:

| バックエンド | 設定 | 音声の選択肢 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | 上記の組み込みタイプに加え、`edge-tts --list-voices` が返す任意の音声 |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`〜`M5`、`F1`〜`F5`。言語は `ko`、`en`、`es`、`pt`、`fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | ユーザーが提供する許可済み参照 WAV。スタイルのデフォルトは `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | CosyVoice 用の参照サンプル音声、またはバックエンド対応の話者/モデル ID |

## 発話の分割

`UTTERANCE_IDLE_MS` は、音声セグメント後に、ブリッジがユーザーの発話完了を判断して STT を開始するまで待つ時間を制御します。デフォルトは `4500` ms で、自然な間を含む長めの音声指示を保つためです。値を小さくすると短いコマンドでは速く感じますが、長いディクテーションを分割することがあります。大きい値は、考えながら話す場合により安全です。

```bash
UTTERANCE_IDLE_MS="4500"  # バランスのよいデフォルト
UTTERANCE_IDLE_MS="6000"  # ポーズを含む長いディクテーションでより安全
```

## MCP サーバー

VerbalCoding には stdio MCP サーバーが付属しており、Hermes Agent または任意の MCP クライアントは、スキルや自由形式のシェルコマンドに頼らず、ツール経由でブリッジを制御できます。

Hermes 設定例:

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

公開される MCP ツール:

| ツール | 目的 |
|---|---|
| `status` | 秘密情報を出さずにブリッジ/設定状態を報告 |
| `doctor` | 秘密情報を伏せた doctor チェックを実行 |
| `set_auto_restart` | コミット時の音声ボット自動再起動を有効/無効化 |
| `set_language` | STT/進捗/TTS 言語をまとめて更新 |
| `start`, `stop`, `restart` | Discord 音声ブリッジを制御 |

## 任意の OpenVoice TTS

Edge TTS がデフォルトかつフォールバックです。OpenVoice V2 によるローカル音声クローンを試すには:

```bash
./scripts/setup_openvoice.sh
# OpenVoice docs から checkpoints_v2_0417.zip をダウンロードし、vendor/OpenVoice/checkpoints_v2/ の下に展開します
mkdir -p voice-samples
# 許可済み参照サンプルを voice-samples/user-reference.wav に置くか、
# Discord で !voice-clone capture を使ってキャプチャします。
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

次を設定します:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

自分が所有している、または使用許可を得ている音声だけをクローンしてください。OpenVoice が失敗またはタイムアウトした場合、VerbalCoding は Edge TTS にフォールバックします。

## 任意の Supertonic TTS

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

次を設定します:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

Supertonic がない、失敗する、またはタイムアウトする場合、VerbalCoding は Edge TTS にフォールバックします。

## 任意の SpeechSwift / CosyVoice TTS

Apple Silicon では、`speech-swift` は MLX ネイティブの CosyVoice/Qwen3-TTS を使った韓国語音声クローン用ローカルバックエンドです。

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

推奨 env:

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"
SPEECHSWIFT_ENGINE="cosyvoice"
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"
```

短い進捗/相づちプロンプトには Edge を維持してください。

## 運用メモ

- テキストコマンドには、Discord の特権 Message Content intent をボットで有効にする必要があります。
- ボットには音声チャンネルへの接続/発話権限が必要です。
- Hermes Agent では、デフォルトプロファイルで通常どおり Hermes を設定/認証してください（`hermes setup`、`hermes login` など）。
- Claude Code、Codex、Gemini、OpenCode、OpenClaw では、それぞれの CLI を別途インストールして認証してください。
- CLI がタイムアウトやシグナル失敗時に diff/code 出力を出した場合、ブリッジはそれを読み上げず、詳細テキストとして送信します。
