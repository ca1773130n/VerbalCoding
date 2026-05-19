# Codex — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

Codex CLI は OpenAI のターミナルコーディングエージェント。VerbalCoding は `codex exec` で呼び出します。`codex exec` は `--output-last-message <path>` 付与時に最終応答を一時ファイルへ書くため、アダプタが自動でこのフラグを差し込み、stdout が騒がしくても確実にファイルから読み取ります。

## インストール

```bash
npm install -g @openai/codex
codex login              # ヘッドレスなら OPENAI_API_KEY
codex exec "hello"
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=codex
# 任意
CODEX_COMMAND="codex exec"                      # 既定
AGENT_PROJECT_CONTEXT="作業内容と既決定事項。"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE` は未使用 (Codex `exec` は呼び出し間 stateless)。

## 出力キャプチャ

Codex 用にアダプタは:

1. `os.tmpdir()` 配下に `verbalcoding-codex-last-<pid>-<ts>.txt` を作成。
2. 最終 prompt 引数の直前に `--output-last-message <path>` を挿入。
3. 実行後そのファイルを応答として読み取り (stdout より優先)。
4. 一時ファイルを削除。

Codex が stdout にツール使用ログを出しても、音声化される答えは常にキャプチャ済ファイル基準。

## Codex へ切り替える音声表現

- en: `"switch to Codex"`, `"ask Codex what it thinks"`
- ja: `"Codex に切り替えて"`, `"Codex に聞いて"`

## 罠

- **長時間タスク。** 分単位のコード生成には `AGENT_TASK_TIMEOUT_MS=0`。アダプタが `signal.aborted` を尊重するので barge-in は綺麗に切れます。
- **セッション再開なし。** `AGENT_PROJECT_CONTEXT` で文脈を渡し、ルート変更後の連続性はクロスエージェントハンドオフブロックに任せる。
- **patch 出力安全策。** ターン中断時に Codex が diff 途中だった場合、bridge は diff を読み上げず "中断" 通知のみ、テキストチャンネル確認を促す。
- **認証。** OpenAI 401 は非零 exit。既定外なら fallback プロンプトが既定エージェントへの retry 提案。
