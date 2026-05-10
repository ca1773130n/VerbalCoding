# VerbalCoding

<p align="center"><strong>像打电话一样，通过 Discord 语音控制 CLI 编程代理。</strong></p>

<p align="center"><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.es.md">Español</a> · <a href="./README.fr.md">Français</a> · <a href="./README.ru.md">Русский</a></p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20SpeechSwift-0EA5E9">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## 为什么需要它

VerbalCoding 把 Discord 语音房间变成编码代理的免提驾驶舱。你说出需求，让 CLI 代理工作，并收到简短语音回复和文本记录；diff 和日志不会被 TTS 长篇朗读。

## 体验亮点

| 能力 | 价值 |
|---|---|
| 电话式工作流 | 在同一个 Discord 语音频道里说话、收听、打断、继续。 |
| 面向人的引导设置 | `vc setup` 一次引导 prerequisites、Discord token/client ID、voice channel、transcript target、backend 和 TTS 设置。 |
| 本地语音闭环 | Discord audio → local `whisper-cli` → selected CLI agent → TTS reply。 |
| 可选代理 | 支持 Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw 或 custom command。 |
| 真实运维支持 | 内置 doctor auto-fix、Docker UDP 指南、latency metrics、multi-instance rooms 和 redacted config checks。 |

## 快速开始

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

普通用户路径是 `vc setup`。运行时请打开 Discord Developer Portal，并按提示输入 bot token、application/client ID、transcript target 和 voice channel names。

自动化场景可以跳过提示，然后再补充 Discord 信息。

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

## 一分钟完成 Discord 设置

1. 在 Discord Developer Portal 创建 application 和 bot。
2. 启用 Message Content privileged intent。
3. 运行 `vc setup`，粘贴 bot token 和 application/client ID。
4. 输入要自动加入的精确 voice channel 名称。
5. 用下面的命令邀请 bot。

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## 迷你命令地图

```bash
vc setup                                 # 引导式设置: prerequisites, Discord, backend, voice
vc setup --yes                           # 非交互 bootstrap/starter config
vc setup token                           # 稍后轮换或添加 Discord bot token/client ID
vc setup channels "General,Team Voice"   # 更新 auto-join voice channel names
vc bot invite CLIENT_ID                  # 生成 Discord bot invite URL
vc status                                # 显示当前设置
vc language ko|en|auto                   # 切换 language preset
vc doctor                                # redacted health check 和 auto-fix
vc start                                 # 启动默认 bridge
vc instance setup NAME                   # 创建隔离的 project voice bot
vc instance start NAME                   # 后台运行该 bot
```

## 了解更多

| 指南 | 内容 |
|---|---|
| [文档中心](docs/i18n/README.zh.md) | 本地化指南索引。 |
| [Fresh Install](docs/i18n/FRESH_INSTALL.zh.md) | npm/global setup、Discord 设置、首次运行。 |
| [Usage](docs/i18n/USAGE.zh.md) | CLI 命令、Discord 命令、运行模式、latency。 |
| [Configuration](docs/i18n/CONFIGURATION.zh.md) | .env、agent backends、MCP、TTS、运维。 |
| [Troubleshooting](docs/i18n/TROUBLESHOOTING.zh.md) | Docker UDP、token/channel 缺失检查。 |
| [Multi-Instance](docs/i18n/MULTI_INSTANCE.zh.md) | 每个项目一个固定语音房间。 |

## 要求

| 层级 | 默认 |
|---|---|
| Runtime | Node.js 20+ 和 npm。 |
| Audio | `ffmpeg` 和 local `whisper-cli`。 |
| TTS | 默认 Edge TTS；可选 OpenVoice、SpeechSwift/CosyVoice、Supertonic。 |
| Discord | Bot token、Message Content intent、voice permissions、匹配的 channel names。 |
| Agent | 至少一个已认证 CLI harness；默认 Hermes Agent。 |

## Docker / 容器说明

如果日志出现 `Cannot perform IP discovery - socket closed`，说明 Discord voice UDP 被阻断。在 Linux Docker Compose 中使用：

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

不要同时使用 `network_mode: "host"` 和 `ports:`。

## 贡献

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## 状态

VerbalCoding 面向公开发布，但仍处于早期阶段。演示视频/GIF、更广泛的 Linux 验证、CI 和安全审查仍是 TODO。
