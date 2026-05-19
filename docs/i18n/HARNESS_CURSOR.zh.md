# Cursor CLI — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

Cursor CLI (`cursor-agent`) 是 Cursor 的终端代理。VerbalCoding 通过 `cursor-agent --print --prompt` 驱动,将 STT 结果作为 prompt 值传入。`--print` 保证非交互。

## 安装

```bash
cursor-agent --print --prompt "hello"
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=cursor                                       # 也接受 'cursor-cli'
CURSOR_COMMAND="cursor-agent --print --prompt"             # 默认
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## 切到 Cursor 的语音表述

- en: `"switch to Cursor"`、`"switch to cursor cli"`、`"switch to cursor agent"`
- zh: `"切到 Cursor"`

别名: `cursor`、`cursor cli`、`cursor-cli`、`cursor agent`、`cursor-agent`。

## 坑

- **prompt 位置。** `--prompt` 期待紧随其后的值。VerbalCoding 的 shell-aware argv 构造器将 STT 结果作为末尾 positional 参数,因此 `CURSOR_COMMAND` 必须以 `--prompt` 结尾。
- **编辑器副作用。** Cursor CLI 可能在工作目录写 cursor 相关状态文件;纯语音流中若不希望如此,把 `AGENT_WORKDIR` 指向隔离目录。
- **无会话续接。** 用 `AGENT_PROJECT_CONTEXT` 维持连续性,从其它 harness 切回时还有跨代理 handoff 块兜底。
- **patch 安全。** Cursor 在 diff 期间被中断时,bridge 不朗读 diff。
