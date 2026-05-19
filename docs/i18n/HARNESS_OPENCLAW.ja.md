# OpenClaw — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

OpenClaw はオープンソースのターミナルコーディングエージェント。VerbalCoding は `openclaw run` で呼び出します。

## インストール

上流 OpenClaw インストールガイドに従い、確認:

```bash
openclaw run "hello"
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=openclaw
# 任意
OPENCLAW_COMMAND="openclaw run"             # 既定
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## OpenClaw へ切り替える音声表現

- en: `"switch to OpenClaw"`, `"ask OpenClaw ..."`, `"switch to open claw"`
- ja: `"OpenClaw に切り替えて"`

エイリアス: `openclaw`, `open claw`。

## 罠

- **既定コマンドはセッション再開なし。** ビルドが resume フラグをサポートしていれば `OPENCLAW_COMMAND` に追加。
- **詳細進捗。** OpenCode と同じく、`SMART_PROGRESS_API_KEY` なしではキーワードベースのラベルにフォールバック。
- **名前衝突。** パーサのエイリアス `openclaw` とラベル `OpenClaw` は `claude` / `claude code` と明確に区別。strict モードのルータが両者を混同しません。
