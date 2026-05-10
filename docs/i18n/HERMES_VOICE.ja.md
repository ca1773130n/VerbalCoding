# Hermes 標準音声 vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="README.ja.md">ドキュメント</a> ·
  <a href="USAGE.ja.md">利用ガイド</a> ·
  <a href="CONFIGURATION.ja.md">設定</a> ·
  <a href="TROUBLESHOOTING.ja.md">トラブルシューティング</a>
</p>

> Hermes はすでに Discord 音声チャンネルに対応しています。VerbalCoding はその基本ループを置き換えるものではなく、コーディングエージェントと電話のように作業するためのワークフローレイヤーです。
<!-- /readme-glow-up:intro -->

## Hermes がすでにできること

Hermes Agent の Discord gateway には音声チャンネル対応があります。bot がサーバーに入っていれば、`/voice join` または `/voice channel` で、実行したユーザーが現在入っている VC に参加できます。その後、Whisper/STT で発話を文字起こしし、Edge TTS、ElevenLabs、OpenAI など設定済みの TTS provider で音声回答を再生できます。

基本のライブ音声会話だけなら、この流れで十分です。

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

## VerbalCoding が追加するもの

| 領域 | Hermes 標準音声 | VerbalCoding |
|---|---|---|
| 主目的 | Discord VC での一般的な Hermes 会話 | CLI エージェントと電話のように行うコーディング作業 |
| コマンド | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, multi-instance commands |
| バックエンド | Hermes Agent | Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw、custom command |
| セッション | 通常の Hermes gateway session | プロジェクト/セッションルーティング、VC バインド、対応バックエンドでの音声 + `!ask` テキスト共有コンテキスト |
| 音声 UX | 基本 STT + TTS | 調整済み発話ウィンドウ、言語プリセット、transcript cleanup、text mirror、voice test |
| 割り込み | 基本的な再生動作 | 再生だけ止め、実行中の agent task を誤って殺さない barge-in ルール |
| 長い作業 | 通常の agent 応答 | 進捗/状態音声、verbose tool-progress 要約、diff/log を TTS で読まない保護 |
| 運用 | Hermes gateway の設定 | `vc doctor` auto-fix、redacted diagnostics、latency metrics、Docker UDP ガイド、multi-bot/project rooms |

## どちらを選ぶべきか

**Hermes 標準音声**は、単純な「話す → 文字起こし → 回答 → 音声再生」で十分なときに向いています。

**VerbalCoding**は、プロジェクトごとの部屋、音声とテキストの共有コンテキスト、複数 CLI エージェント、韓国語/英語プリセット、長時間作業中の安全な割り込み、進捗音声、運用診断が必要なときに向いています。

## 正直な位置づけ

VerbalCoding を「Hermes に Discord 音声を初めて追加するもの」と説明すべきではありません。Hermes にはすでに基本機能があります。より正確には、VerbalCoding は Hermes を既定バックエンドとして使える、CLI コーディングエージェント向けの Discord 音声ワークフローレイヤーです。
