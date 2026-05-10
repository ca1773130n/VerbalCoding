# Hermes 内置语音 vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="README.zh.md">文档中心</a> ·
  <a href="USAGE.zh.md">使用指南</a> ·
  <a href="CONFIGURATION.zh.md">配置</a> ·
  <a href="TROUBLESHOOTING.zh.md">故障排查</a>
</p>

> Hermes 已经支持 Discord 语音频道。VerbalCoding 不是替代这个基础能力，而是在其上提供面向编码代理的“电话式”工作流层。
<!-- /readme-glow-up:intro -->

## Hermes 已经支持什么

Hermes Agent 的 Discord gateway 内置了语音频道支持。bot 加入服务器后，用户可以通过 `/voice join` 或 `/voice channel` 让它加入自己当前所在的 VC。随后 Hermes 会用 Whisper/STT 转写语音，并通过 Edge TTS、ElevenLabs、OpenAI 等已配置的 TTS provider 在语音频道中回答。

如果你只需要基础实时语音对话，这个闭环已经足够：

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

## VerbalCoding 增加什么

| 领域 | Hermes 内置语音 | VerbalCoding |
|---|---|---|
| 主要目标 | 在 Discord VC 中进行普通 Hermes 对话 | 像打电话一样使用 CLI 编码代理工作 |
| 命令 | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, 多实例命令 |
| 后端 | Hermes Agent | Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw 或自定义命令 |
| 会话模型 | 普通 Hermes gateway 会话 | 项目/会话路由、语音频道绑定、支持时共享语音 + `!ask` 文本上下文 |
| 语音体验 | 基础 STT + TTS | 调整过的发话窗口、语言预设、转写清理、文本镜像、语音测试 |
| 打断 | 基础播放行为 | 停止当前播放，但避免误杀正在运行的 agent 任务 |
| 长任务 | 普通 agent 回复 | 进度/状态语音、verbose 工具进度摘要、避免朗读巨大 diff/log |
| 运维 | Hermes gateway 配置 | `vc doctor` 自动修复、脱敏诊断、延迟指标、Docker UDP 指南、多 bot/项目房间 |

## 如何选择

选择 **Hermes 内置语音**：你只需要一个 bot 在一个 Discord 语音频道中完成简单的“说话、转写、回答、朗读”。

选择 **VerbalCoding**：你需要项目级房间、语音与文本共享上下文、多 CLI agent 后端、韩/英语言预设、长任务中的安全打断、进度语音、延迟指标和 `vc doctor` 这类运维工具。

## 准确定位

不要把 VerbalCoding 描述成“给 Hermes 从零添加 Discord 语音”。Hermes 已经有基础语音功能。更准确的说法是：VerbalCoding 是面向 CLI 编码代理的 Discord 语音工作流层，可以使用 Hermes 作为默认后端，并为长时间软件工作添加项目路由、打断语义、进度 UX、诊断和后端切换。
