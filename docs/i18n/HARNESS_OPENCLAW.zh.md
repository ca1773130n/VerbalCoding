# OpenClaw — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

OpenClaw 是开源终端编码代理。VerbalCoding 通过 `openclaw run` 驱动。

## 安装

```bash
openclaw run "hello"
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=openclaw
# 可选
OPENCLAW_COMMAND="openclaw run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## 切到 OpenClaw 的语音表述

- en: `"switch to OpenClaw"`、`"switch to open claw"`
- zh: `"切到 OpenClaw"`

别名: `openclaw`、`open claw`。

## 坑

- **默认命令无会话续接。** 若构建支持 resume,加入 `OPENCLAW_COMMAND`。
- **详细进度。** 与 OpenCode 相同 — 无 `SMART_PROGRESS_API_KEY` 时回退到关键字标签。
- **名称冲突。** 解析器别名 `openclaw` 与用户标签 `OpenClaw` 与 `claude` / `claude code` 明确区分,strict 模式不会混淆。
