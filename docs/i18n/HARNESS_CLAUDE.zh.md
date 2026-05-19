# Claude Code — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

Claude Code 是 Anthropic 官方的终端编码代理。VerbalCoding 通过 `claude -p` 驱动,每个语音 turn 一次调用。`-p` 没有稳定的跨调用会话续接,因此每次都是全新上下文 — 通过 `AGENT_PROJECT_CONTEXT` 和跨代理 handoff 块保持连续性。

## 安装

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"     # 确认能回应
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=claude              # 也接受 'claude-code' 别名
# 可选
CLAUDE_COMMAND="claude -p"        # 默认,可加 --model、--debug
AGENT_PROJECT_CONTEXT="auth 模块工作中;既定:oauth=github。"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE` 默认 `<repo>/.agent-sessions/claude`,但此 harness **未使用** — Claude Code 的 `-p` 是无状态的。

## 每个 turn Claude 收到的内容

每个 turn,适配器按顺序前置: Discord 语音前言 (按 `VOICE_LANGUAGE` 英文或中文)、项目上下文、最近 Discord 文本上下文,最后是用户的 STT 发言。跨代理 handoff 时 (例如上 turn 说了 `"ask Codex ..."`),还会加入 "最近用户语音" 行 (最多 4 条) 和最近已解决的计划决定,避免 Claude 冷启。

## 详细进度

Claude Code 在 `-p` 下不发出标准 progress stream。开启 `AGENT_VERBOSE_PROGRESS=1` 时,适配器会从 stdout/stderr 关键字解析工具/文件/网页提及,但粒度比 Hermes 粗。

## 切到 Claude Code 的语音表述

- en: `"switch to Claude Code"`、`"ask Claude ..."`、`"let Claude finish this"`
- zh: `"切到 Claude"`、`"问 Claude"`

匹配器接受 `claude` 和 `claude code`。路由专用发言使用 strict 模式,需精确匹配。

## 坑

- **无会话续接。** 长配对编程依赖跨代理 handoff 上下文块来传递决定;同一后端内,设 `AGENT_PROJECT_CONTEXT` 为简短摘要。
- **带引号的命令路径。** 若 `CLAUDE_COMMAND` 含带空格的绝对路径 (如 `"/Applications/Claude Code/claude" -p`),VerbalCoding 的安装检测会用 `shellSplit` 正确处理引号。
- **认证刷新。** `claude login` 令牌失效会以非零退出;bridge 报告失败,如果不是默认后端,fallback 会建议改用默认代理。
- **patch 形输出。** 如果 Claude 在返回 diff 时被中断,bridge 不会朗读 diff,而是说 "代理被中断;请在文本频道确认文件与测试状态"。
