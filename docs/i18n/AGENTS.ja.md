# リポジトリガイドライン (日本語)

> 本ファイルは [`AGENTS.md`](../../AGENTS.md) の日本語要約です。正式なルールは英語の本文を参照してください。

VerbalCoding はコーディングエージェント向けの Discord 音声ブリッジです。実装は `app-node/` 配下の Node 実装で、`run.sh` または `vc` CLI 経由で起動します。

## 開発

- ドキュメント / サンプルでは `vc ...` を `npm run vc -- ...` より優先してください。
- ローカルシークレットは `.env` または `instances/*.env` に置き、実 Discord トークン、チャンネル ID、セッションファイル、音声サンプル、モデル重み、venv、ログ、キャッシュ出力はコミットしないでください。
- 自動生成物ではなくソースファイルを編集してください。
- サンプルは公開しても安全な値で。ローカルパス、ユーザー ID、Discord ID、トークンはプレースホルダで。

## 検証

コード変更を完了とする前に Node テストを走らせてください:

```bash
npm test
```

## モジュール構成

詳細は [`AGENTS.md`](../../AGENTS.md) を参照。主要モジュール:

- `main.mjs` — Discord / 音声 / エージェントのディスパッチャ
- `agent_routing.mjs` — 音声主導のクロスエージェントルーティング
- `plan_mode.mjs` — 音声プランモード(`which_agent` スロット)
- `session_ontology.mjs` — チャネル単位の typed graph(handoff 用)
- `research_mode.mjs` — `"research X"` 音声コマンドパイプライン

## 管理ブロック

HarnessSync が `AGENTS.md` に `CLAUDE.md` のルールを同期します。当該ブロックは編集しないでください。
