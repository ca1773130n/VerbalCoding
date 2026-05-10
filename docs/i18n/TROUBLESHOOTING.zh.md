# VerbalCoding 故障排查

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="README.zh.md">文档中心</a> ·
  <a href="FRESH_INSTALL.zh.md">Fresh Install</a> ·
  <a href="USAGE.zh.md">Usage</a> ·
  <a href="CONFIGURATION.zh.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.zh.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.zh.md">Multi-Instance</a>
</p>

> 最快路径: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

## `Cannot perform IP discovery - socket closed`

此错误表示机器人已登录 Discord 并找到了语音频道，但 Discord 语音 UDP 发现失败。

在 Linux Docker Compose 中使用：

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

请移除同一服务的 `ports:`。Docker Desktop macOS/Windows 的 host networking 行为不同；如果仍失败，请在宿主机或 Linux VM 上运行。

## Token and channel setup

缺少令牌时运行 `vc setup token`；频道名称不匹配时运行 `vc setup channels "<真实语音频道>"`。

```bash
vc setup token
vc setup channels "General,Team Voice"
vc doctor
```
