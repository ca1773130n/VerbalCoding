# コーディングエージェントハーネス

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="README.ja.md">ドキュメントハブ</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a> ·
  <a href="TROUBLESHOOTING.ja.md">トラブルシュート</a>
</p>

VerbalCoding はエージェント非依存です。インストール済みの CLI コーディングエージェントを音声ターンごとに 1 回起動し、STT した発話を prompt として渡し、応答を音声で返します。**1 つ**を既定として選び、音声ルーティングで他のエージェントへ一時的に切り替えます。

| ハーネス | 既定コマンド | セッション再開 | ハーネス別ドキュメント |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.ja.md](./HERMES_VOICE.ja.md) · [HARNESS_HERMES.ja.md](./HARNESS_HERMES.ja.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.ja.md](./HARNESS_CLAUDE.ja.md) |
| Codex | `codex exec` | ❌ (最終メッセージファイル取得) | [HARNESS_CODEX.ja.md](./HARNESS_CODEX.ja.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.ja.md](./HARNESS_GEMINI.ja.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.ja.md](./HARNESS_OPENCODE.ja.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.ja.md](./HARNESS_OPENCLAW.ja.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.ja.md](./HARNESS_AIDER.ja.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.ja.md](./HARNESS_CURSOR.ja.md) |

## 既定エージェントの選択

`vc setup` がインストール済みバイナリを自動検出して選択肢を提示します。非対話設定:

```bash
# .env または instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

各ハーネスは自分のコマンドを同名の env (`HERMES_COMMAND`, `CLAUDE_COMMAND` など) から読みます。共通 env (`AGENT_LABEL`, `AGENT_COMMAND`, `AGENT_SESSION_FILE`, `AGENT_WORKDIR`, `AGENT_PROJECT_CONTEXT`, `AGENT_TASK_TIMEOUT_MS`, `AGENT_CHAT_TIMEOUT_MS`, `AGENT_VERBOSE_PROGRESS`) は当該ハーネス既定値を上書きします。

## 音声でのルーティング

設定後は再起動なしで**インストール済み**の任意ハーネスへ届きます:

- `"ask Codex what it thinks"` — 単一ターンのみ Codex、次ターンは既定へ復帰。
- `"switch to Aider"` — sticky ルート、`"back to default"`まで持続。
- プランモードの `which_agent` スロット — エージェント自身が次のプランの実行先を提案。

ルーティング層はバイナリの `PATH` 存在を確認し(プロジェクトセッションの workdir からの相対パスも解決)、未インストールなら `"既定エージェントで代わりに進める?"` と尋ねます。`"yes"` で既定に fallback、`"no"` でキャンセル。

パーサが認識するエイリアス: `claude` / `claude code`, `codex` / `コーデックス`, `gemini` / `gemini cli` / `ジェミニ`, `opencode`, `openclaw`, `aider`, `cursor` / `cursor cli`, `hermes`.

## 共通動作

全ハーネスアダプタが共通で扱うもの:

- **音声プランモード** — `"plan it first"` でプランを narrate、音声で編集、`"approve"` で選択ハーネスへ実行。
- **割り込み** — barge-in は現在の TTS を切り、エージェントタスクを abort。sticky ルートは割り込み後も維持、単一ターンルートのみクリア。
- **詳細進捗** — `AGENT_VERBOSE_PROGRESS=1` (または `"verbose progress on"`) でハーネスが emit する進捗イベントを表示。`SMART_PROGRESS_API_KEY` 設定で LLM 要約器がバッチごとに 1 文に。
- **プッシュ通知ハンドオフ** — `NOTIFY_PROVIDER=ntfy|pushover` + `NOTIFY_MIN_TASK_MS` を満たし、音声チャンネルが空のときに push。body + `NOTIFY_DEBOUNCE_MS` で debounce。
- **チャンネル別状態** — Discord 音声チャンネルごとにルーティング・プラン状態・発話リングバッファを保持。
- **プロジェクトセッション** — `!session new <name> <workdir>` でチャンネルとプロジェクトを束ねる。(ハーネス, セッション) 別アダプタはキャッシュされ rebind 時に無効化。

ハーネス別の install パス、認証、罠は各ドキュメント参照。env リファレンスは `docs/CONFIGURATION.ja.md`。
