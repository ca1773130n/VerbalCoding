# Hermes Agent — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

Hermes Agent は VerbalCoding の既定バックエンドで、真のセッション再開契約を持つ唯一のハーネスです。ターン間のコンテキストがきれいに保たれます。Hermes 内蔵の `/voice` スラッシュコマンドとの位置付け比較は [HERMES_VOICE.ja.md](./HERMES_VOICE.ja.md)。

## インストール

上流の Hermes Agent インストールガイド: <https://hermes-agent.nousresearch.com>

まず CLI 単体で動作確認:

```bash
hermes chat -Q -q "hello"
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=hermes
# 任意
HERMES_COMMAND="hermes chat -Q -q"           # 既定
HERMES_HOME=/Users/you/.hermes               # インスタンス別 Hermes ホーム
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0                     # 0 = 無制限
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

セッションファイルの既定パスは `<repo>/.verbalcoding-session` (`HERMES_SESSION_FILE` で上書き)。

## セッション再開

Hermes は内蔵アダプタの中で唯一セッション再開をサポートします。ターン成功ごとに新 `session_id` をディスクに書き、次回呼び出しに `--resume <id>` を前置します。`!session reset` (または `!reset-session`) でクリア。

Hermes が stderr に `session_id:` を emit する前にターンが abort された場合、アダプタが `~/.hermes/sessions/session_<id>.json` を直接読み最終応答を復元します。

## 詳細進捗

詳細モードではアダプタが Hermes の `-Q` quiet フラグを外し、stdout に `┊ <emoji> <tool>` のプレビューが流れます。これらは 1 行進捗イベント(ファイル読み込み、Web 検索、ターミナル実行など)に要約されます。詳細オフ時は最終ボックス内応答のみ音声化。

## Hermes へ切り替える音声表現

- en: `"switch to Hermes"`, `"ask Hermes ..."`
- ja: `"Hermes に切り替えて"`, `"Hermes に聞いて"`

## 罠

- クロスエージェントハンドオフ時の TTS 接頭辞はロケール準拠 (`"Hermes says: "` / `"ヘルメス: "`)。
- `HERMES_HOME` はプロジェクト別の最も一般的な分離ノブ。インスタンス `.env` は通常 `HERMES_HOME=/Users/you/.hermes/profiles/<project>` を設定。
- 詳細オン時に Hermes が空ボックスで終了(タイムアウト等)した場合、諦める前にアダプタがセッション JSON を漁って最終応答を取得します。
