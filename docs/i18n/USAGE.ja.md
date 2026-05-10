# VerbalCoding 使い方ガイド


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

このページには、README を長くしすぎていた運用上の詳細をまとめています。

## CLI コマンド

```bash
vc status                    # STT 言語、進捗言語、TTS 音声を表示
vc language en               # 英語 STT + 英語の進捗/TTS 音声
vc language ko               # 韓国語 STT + 韓国語の進捗/TTS 音声
vc language auto             # Whisper 自動検出 STT + 英語の進捗/TTS 音声
vc restart auto status       # コミット時の音声ボット自動再起動設定を表示
vc restart auto on           # コミット時の音声ボット自動再起動を有効化
vc restart auto off          # 無効化。これがデフォルト
vc bot invite CLIENT_ID      # 必要な権限付きの Discord 招待 URL を出力
vc instance status           # インスタンスごとのブリッジ設定とプロセス状態を一覧表示
vc instance setup NAME       # instances/NAME.env を書き、~/.hermes/profiles/NAME を作成
vc instance start NAME       # ./run.sh instances/NAME.env をデタッチして起動
vc instance stop NAME        # デタッチされたインスタンスを停止し pid ファイルを削除
vc doctor                    # 秘密情報を伏せた doctor チェックを実行
npm run mcp                  # stdio MCP サーバーを実行
```

言語変更は `.env` を更新します。反映するには `./run.sh` または利用中のプロセスマネージャーでブリッジを再起動してください。

## 実行モード

単一インスタンスのブリッジ:

```bash
./run.sh
```

ローカルの上書き env を使うインスタンス別ブリッジ:

```bash
./run.sh instances/my-project.env
# または
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

ボットは最初に設定されたチャンネル名へ自動参加します。デフォルトは `일반,General,general` です。

## Discord コマンド

コマンドを接続する前に、上流ガイドに従って Discord アプリケーション/ボットをセットアップしてください:

- Hermes Agent の Discord ガイド: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 公式ボットドキュメント: <https://docs.discord.com/developers/bots/overview>

その後、`vc bot invite CLIENT_ID` を使って、テキストおよび音声権限を持つ VerbalCoding 専用の招待 URL を生成します。

| コマンド | 目的 |
|---|---|
| `!ping` | 基本的なボット確認 |
| `!join` / `!leave` | 音声に参加または退出 |
| `!say <text>` | TTS でテキストを直接読み上げ |
| `!voice-test <text>` | 有効な TTS バックエンド/音声をテスト |
| `!voice-clone capture` | 次の有効な発話を OpenVoice 参照サンプルとして保存 |
| `!voice-clone status` / `!voice-clone cancel` | キャプチャ状態を確認またはキャンセル |
| `!ask <prompt>` | 音声と同じ選択済みハーネスアダプター経由でテキストを送信 |
| `!session status` | 現在のプロジェクト/デフォルトアダプターセッションを表示 |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | プロジェクトスコープの Hermes セッションを作成 |
| `!session attach-voice [sessionName] --voice <voice-channel>` | テキストチャンネル/スレッドを音声チャンネルに紐付け |
| `!session list` | 設定済みプロジェクトセッションを一覧表示 |
| `!session reset` / `!reset-session` | 現在のプロジェクト/デフォルトアダプターセッションファイルを消去 |
| `!verbose on/off` | 詳細な進捗更新を切り替え |
| `!latency` / `!metrics` | 直近のレイテンシ要約を表示 |
| `!sensitivity normal/conservative` | 割り込み感度を切り替え |

「외부 모드」「보수 모드」「실내」「기본 감도」などの音声での同等表現や、「잠깐」「멈춰」「그만」のような明確な停止フレーズはブリッジが処理します。また、「상세 진행 켜」/「상세 진행 꺼」と言うことで、音声でも詳細進捗を切り替えられます。

## 音声を変更する

`vc language ko|en|auto` は、STT 言語、進捗言語、対応するデフォルト TTS 音声をまとめて変更します。ブリッジの実行中に話者/音声だけを変更したい場合は、Discord 音声で次のように話します:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

実行中のブリッジはこれらを音声制御コマンドとして認識し、`config/tts-voices.json` を更新し、実行中プロセスの有効な TTS env を更新して、「목소리를 Korean male로 바꿨어。」のような短い確認で応答します。変更直後に `!voice-test <text>` を使うと、現在のバックエンドと音声を聞けます。

組み込み Edge 音声タイプ:

| 音声タイプ | Edge 音声 |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

永続的な手動設定では、`.env` に `TTS_BACKEND=edge`、`TTS_VOICE_TYPE=<voice-type>`、必要に応じて `TTS_VOICE=<edge-voice>` を設定するか、カスタム音声カタログ用に `config/tts-voices.json` を編集します。

バックエンド固有の音声ノブ:

| バックエンド | 音声設定 | 一般的な選択肢 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`、`korean_female`、`korean_multilingual_male`、`english_male`、`english_female`。`edge-tts --list-voices` が返す任意の Edge 音声 |
| Supertonic | `SUPERTONIC_VOICE` | `M1`〜`M5`、`F1`〜`F5`。`SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` を設定 |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | 許可済み参照 WAV と、`default` などのスタイル |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | CosyVoice 用の参照 WAV、またはバックエンド対応の話者/モデル値 |

Supertonic とローカルクローンバックエンドでは、上記のバックエンド env 変数に加えて `!voice-test <text>` を使い、変更を試聴してください。音声コマンドによる切り替えは、現在は組み込みの Edge 風音声タイプにマッピングされます。より豊富なバックエンドカタログは `config/tts-voices.json` に追加できます。

## 長いディクテーションとポーズ

VerbalCoding は、音声を STT に送る前に無音ウィンドウを待ちます。デフォルトの `UTTERANCE_IDLE_MS=4500` は意図的に少し余裕を持たせています。長い指示の自然な間で文を分割したり、エージェントターンを早く始めすぎたり、その後の発話を処理中の割り込みとして扱ったりしないためです。

短いコマンドをより速くしたい場合は `.env` で小さくしてください。長い韓国語ディクテーションがまだ分割される場合は大きくしてください:

```bash
UTTERANCE_IDLE_MS="6000"
```

## 詳細進捗モード

`AGENT_VERBOSE_PROGRESS=1` が設定されていない限り、詳細進捗はデフォルトでオフです。`!verbose on` または「상세 진행 켜」のような音声コマンドで有効にします。次のような短い進捗行を出力できます:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

このモードは、選択された CLI ハーネスに `VERBALCODING_PROGRESS: ...` 行の出力を求め、利用可能な場合はストリーミング stdout/stderr から一般的なツールマーカーを要約します。秘密情報に見えるフィールドは伏せられ、進捗行は最終的に読み上げられる回答から削除されます。

## レイテンシ指標

VerbalCoding はターンごとのレイテンシ記録を JSONL として書き込みます。デフォルトパス:

```text
./.logs/latency.jsonl
```

各レコードには、ステータス、合計時間、音声キャプチャ時間、発話アイドル待ち、STT 時間、エージェント時間、TTS 合成/再生時間、チャンク数、文字起こし長、回答長、利用可能な場合の音声レベルが含まれます。

Discord 内:

```text
!latency
!metrics
```

要約は最新 200 件のレコードを使い、件数、平均、p95、最大、OK 以外のステータスを表示します。

## テスト

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` は意図的に秘密情報を伏せ、必要な値が設定されているかだけを報告します。また、`instances/*.env` について、重複するトークンフィンガープリントや衝突するランタイムパスも確認します。
