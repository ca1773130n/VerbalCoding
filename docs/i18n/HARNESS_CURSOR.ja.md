# Cursor CLI — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

Cursor CLI (`cursor-agent`) は Cursor のターミナルエージェント。VerbalCoding は `cursor-agent --print --prompt` で呼び出し、STT 結果を prompt 値として渡します。`--print` は非対話実行を維持。

## インストール

上流 Cursor CLI インストールガイドに従い、確認:

```bash
cursor-agent --print --prompt "hello"
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=cursor                                       # 'cursor-cli' エイリアス可
# 任意
CURSOR_COMMAND="cursor-agent --print --prompt"             # 既定
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Cursor へ切り替える音声表現

- en: `"switch to Cursor"`, `"ask Cursor ..."`, `"switch to cursor cli"`, `"switch to cursor agent"`
- ja: `"Cursor に切り替えて"`, `"Cursor に聞いて"`

エイリアス: `cursor`, `cursor cli`, `cursor-cli`, `cursor agent`, `cursor-agent`。

## 罠

- **prompt 位置。** `--prompt` は値を後続させるため、VerbalCoding の shell 認識 argv ビルダーが STT 結果を最後の positional 引数に置きます。`CURSOR_COMMAND` は `--prompt` で終わる必要あり。
- **エディタ副作用。** Cursor CLI はワーキングディレクトリに cursor 関連状態ファイルを書く可能性。音声専用フローで意外な場合は分離プロジェクトディレクトリを `AGENT_WORKDIR` に設定。
- **セッション再開なし。** ターン間連続性は `AGENT_PROJECT_CONTEXT` と、他ハーネスから戻る際のクロスエージェントハンドオフブロックに依存。
- **patch 安全策。** Cursor が diff 中に中断された場合、bridge は diff を読み上げません。
