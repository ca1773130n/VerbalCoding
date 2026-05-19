# Claude Code — ハーネスノート

<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="HARNESSES.ja.md">ハーネス</a> ·
  <a href="USAGE.ja.md">使い方</a> ·
  <a href="CONFIGURATION.ja.md">設定</a>
</p>

Claude Code は Anthropic 公式のターミナル常駐コーディングエージェントです。VerbalCoding は `claude -p` で呼び出し、音声ターン 1 つにつき 1 invocation。`-p` は呼び出し間の安定なセッション再開契約を持たないため毎回新規コンテキスト — 連続性は `AGENT_PROJECT_CONTEXT` とクロスエージェントハンドオフブロックで維持してください。

## インストール

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"     # 応答確認
```

## VerbalCoding 設定

```bash
# .env
AGENT_BACKEND=claude              # 'claude-code' エイリアスも可
# 任意
CLAUDE_COMMAND="claude -p"        # 既定。--model, --debug 追加可
AGENT_PROJECT_CONTEXT="auth モジュール作業中。既決定: oauth=github。"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE` は既定 `<repo>/.agent-sessions/claude` ですが、このハーネスでは**未使用** — Claude Code の `-p` は stateless。設定したままでも no-op。

## 各ターン Claude が受け取るもの

各ターン、アダプタは Discord 音声対応の preamble (`VOICE_LANGUAGE` に応じ英語または日本語)、プロジェクトコンテキスト、最近の Discord テキストコンテキスト、最後に STT 結果を順に prepend します。クロスエージェントハンドオフ時 (前ターンが `"ask Codex ..."` で今回が初復帰など) は "最近のユーザー音声" 行 (最大 4 件) と直近解決済みプラン決定も含み、Claude が cold start しないようにします。

## 詳細進捗

Claude Code は `-p` で標準 progress stream を emit しません。`AGENT_VERBOSE_PROGRESS=1` 時はアダプタが stdout/stderr のツール/ファイル/Web 言及をキーワードで拾いますが、Hermes より粗い情報量。

## Claude Code へ切り替える音声表現

- en: `"switch to Claude Code"`, `"ask Claude ..."`, `"let Claude finish this"`
- ja: `"Claude に切り替えて"`, `"Claude に聞いて"`

マッチャは `claude` と `claude code` 双方をエイリアスとして受けます。ルーティング専用発話で使う strict モードは完全一致のみ。

## 罠

- **セッション再開なし。** 長期ペアプロは、クロスエージェントハンドオフコンテキストブロックに依存して決定を引き継ぎます。バックエンド切替時は自動付与、同一バックエンド内では `AGENT_PROJECT_CONTEXT` に要約を入れておく。
- **引用付きコマンドパス。** `CLAUDE_COMMAND` に空白を含む絶対パス (例: `"/Applications/Claude Code/claude" -p`) がある場合、VerbalCoding のインストール検査は `shellSplit` を使い引用符を正しく扱います。
- **認証更新。** `claude login` トークン失効は非零 exit。bridge が失敗を報告し、既定でなければ fallback プロンプトで既定エージェントへの retry を提案。
- **patch 形式出力。** Claude が diff 返却中に turn が割り込まれた場合、bridge は diff を読み上げず "中断: テキストチャンネルでファイルとテスト状況を確認してください" のみ発話。
