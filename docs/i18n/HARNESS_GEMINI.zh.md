# Gemini CLI — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

Gemini CLI 是 Google 的终端编码代理。VerbalCoding 通过 `gemini -p` 驱动。每个语音 turn 一次调用;调用间无内建会话续接。

## 安装

参考上游 Gemini CLI 指引,确认:

```bash
gemini -p "hello"
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=gemini
# 可选
GEMINI_COMMAND="gemini -p"                  # 默认,可加 --model、--debug
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## 切到 Gemini 的语音表述

- en: `"switch to Gemini"`、`"ask Gemini ..."`、`"switch to Gemini CLI"`
- zh: `"切到 Gemini"`、`"问 Gemini"`

别名: `gemini`、`gemini cli`、`gemini-cli`。

## 坑

- **无会话续接。** 与 Claude / Codex 同样的连续性策略: 依赖 `AGENT_PROJECT_CONTEXT` 与跨代理 handoff 块。
- **长回答。** Gemini 偶尔返回大块结构化响应;流式 sentencer 会切分成 TTS 可读句。代码围栏从语音剥离 (文本频道仍含完整代码)。
- **API 密钥。** Gemini 因鉴权失败非零退出时,bridge 会报告消息;非默认后端时 fallback 提示。
- **详细进度。** Gemini stdout 不是 Hermes `┊` 风格,详细进度主要依赖 smart-progress LLM 摘要。
