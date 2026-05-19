# Gemini CLI — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

Gemini CLI は Google のターミナルコーディングエージェント。VerbalCoding は `gemini -p` で呼び出します。音声ターン 1 つにつき 1 invocation、呼び出し間のセッション再開はありません。

## インストール

上流 Gemini CLI インストールガイドに従い、確認:

```bash
gemini -p "hello"
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=gemini
# 任意
GEMINI_COMMAND="gemini -p"                  # 既定。--model, --debug 追加可
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Gemini へ切り替える音声表現

- en: `"switch to Gemini"`, `"ask Gemini ..."`, `"switch to Gemini CLI"`
- ja: `"Gemini に切り替えて"`, `"Gemini に聞いて"`

エイリアス: `gemini`, `gemini cli`, `gemini-cli`, `ジェミニ`。

## 罠

- **セッション再開なし。** Claude / Codex と同様の連続性戦略: `AGENT_PROJECT_CONTEXT` とクロスエージェントハンドオフブロックに依存。
- **長い応答。** Gemini が大きな構造化応答を返すことがあります。ストリーム sentencer が TTS 可能な文に分割。コードフェンスは音声から除外 (テキストチャンネルには全文)。
- **API キー。** Gemini が認証エラーで非零 exit すると bridge がメッセージを報告。既定外なら fallback プロンプトが既定エージェントへの retry 提案。
- **詳細進捗。** Gemini の stdout は Hermes の `┊` 形式ではないため、詳細進捗は主に smart-progress LLM 要約器に依存。
