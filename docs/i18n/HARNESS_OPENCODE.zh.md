# OpenCode — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

OpenCode 是开源终端编码代理。VerbalCoding 通过 `opencode run` 驱动。

## 安装

参考上游 OpenCode 指引,确认:

```bash
opencode run "hello"
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=opencode
# 可选
OPENCODE_COMMAND="opencode run"             # 默认
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## 切到 OpenCode 的语音表述

- en: `"switch to OpenCode"`、`"ask OpenCode ..."`、`"switch to open code"`
- zh: `"切到 OpenCode"`

别名: `opencode`、`open code`。

## 坑

- **默认命令无会话续接。** 若 OpenCode 构建支持 resume,可改为 `OPENCODE_COMMAND="opencode run --resume"` (适配器会把 prompt 作为末尾 positional 参数)。
- **模型选择。** 若需 `--model` 等标志,直接加入 `OPENCODE_COMMAND`。
- **详细进度。** stdout/stderr 中按关键字匹配 (文件读取、网页搜索、终端)。无 `SMART_PROGRESS_API_KEY` 时 bridge 回退到原始标签。
