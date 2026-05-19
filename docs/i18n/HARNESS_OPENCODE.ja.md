# OpenCode — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

OpenCode はオープンソースのターミナルコーディングエージェント。VerbalCoding は `opencode run` で呼び出します。

## インストール

上流 OpenCode インストールガイドに従い、確認:

```bash
opencode run "hello"
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=opencode
# 任意
OPENCODE_COMMAND="opencode run"             # 既定
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## OpenCode へ切り替える音声表現

- en: `"switch to OpenCode"`, `"ask OpenCode ..."`, `"switch to open code"`
- ja: `"OpenCode に切り替えて"`

エイリアス: `opencode`, `open code`。

## 罠

- **既定コマンドはセッション再開なし。** OpenCode ビルドが resume フラグをサポートしていれば `OPENCODE_COMMAND="opencode run --resume"` のように付与 (アダプタは prompt を最後の positional 引数として渡す)。
- **モデル選択。** OpenCode ビルドが `--model` フラグを要求するなら `OPENCODE_COMMAND` に追加。
- **詳細進捗。** stdout/stderr のイベントをキーワードでマッチ (ファイル読み込み、Web 検索、ターミナル等)。`SMART_PROGRESS_API_KEY` なしでは raw ラベルにフォールバック。
