# VerbalCoding トラブルシューティング

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.ja.md">README</a> ·
  <a href="README.ja.md">ドキュメントハブ</a> ·
  <a href="FRESH_INSTALL.ja.md">Fresh Install</a> ·
  <a href="USAGE.ja.md">Usage</a> ·
  <a href="CONFIGURATION.ja.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.ja.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.ja.md">Multi-Instance</a>
</p>

> 最短経路: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

## `Cannot perform IP discovery - socket closed`

このエラーは、ボットが Discord にログインし音声チャンネルを見つけたものの、Discord 音声の UDP 検出に失敗したことを示します。

Linux Docker Compose では次を使います:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

同じサービスの `ports:` は削除してください。Docker Desktop macOS/Windows では host networking の挙動が異なるため、失敗が続く場合はホストまたは Linux VM で実行してください。

## Token and channel setup

トークンがない場合は `vc setup token`、チャンネル名が違う場合は `vc setup channels "<実際の音声チャンネル>"` を実行します。

```bash
vc setup token
vc setup channels "General,Team Voice"
vc doctor
```
