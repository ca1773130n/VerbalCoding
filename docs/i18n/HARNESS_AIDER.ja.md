# Aider — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

Aider はファイルを直接編集するペアプログラミング AI CLI。VerbalCoding は `aider --no-pretty --yes-always --message` で呼び出し、prompt は `--message` 値として渡されます。音声ターン 1 つが `AGENT_WORKDIR` のファイルを直接書き換え得る非対話 Aider 実行 1 つになります。

## インストール

```bash
pip install aider-chat
aider --version
# 単一メッセージ実行を確認:
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider は使用モデルの API キーが必要 (OpenAI / Anthropic / ローカルサーバ)。<https://aider.chat> 参照。

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=aider
# 任意
AIDER_COMMAND="aider --no-pretty --yes-always --message"   # 既定
AGENT_WORKDIR=/Users/you/code/your-project                 # Aider が編集するディレクトリ
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000                               # Aider は時間がかかることが多い
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty` は Rich のボックス文字を抑え、ストリーム sentencer が詰まらないようにします。`--yes-always` は非対話実行を維持 (Aider が "この diff を適用?" で止まらない)。

## Aider へ切り替える音声表現

- en: `"switch to Aider"`, `"ask Aider to ..."`
- ja: `"Aider に切り替えて"`, `"Aider に頼んで"`

エイリアス: `aider`。

## 罠

- **Aider はファイルを編集します。** `-p` モードの Claude / Codex / Gemini と異なり、Aider は応答時にワーキングツリーを直接変更。`AGENT_WORKDIR` を慎重に指定 — 通常はプロジェクトセッションの `workdir`。
- **出力に diff。** Aider はしばしば diff 形式のテキストを出力。ターン中断時は "中断" 通知のみ発話し diff は読み上げません — テキストチャンネルと `git status` で確認。
- **認証。** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` を Aider の環境に。インスタンス分離は通常 `instances/<project>.env` を使用。
- **チャンネル別状態。** クロスエージェントルーティングは Discord チャンネル単位。あるプロジェクトルームで Aider に切り替えても他ルームには影響しません。
