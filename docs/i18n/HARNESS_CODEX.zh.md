# Codex — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

Codex CLI 是 OpenAI 的终端编码代理。VerbalCoding 通过 `codex exec` 驱动。`codex exec` 在带 `--output-last-message <path>` 时会把最终助手文本写到临时文件,适配器会自动插入此标志,并从文件可靠读取答案,即便 stdout 嘈杂。

## 安装

```bash
npm install -g @openai/codex
codex login              # 或 headless 设 OPENAI_API_KEY
codex exec "hello"
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=codex
# 可选
CODEX_COMMAND="codex exec"                      # 默认
AGENT_PROJECT_CONTEXT="工作内容与已定事项。"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE` 未使用 (Codex `exec` 跨调用无状态)。

## 输出抓取

针对 Codex,适配器:

1. 在 `os.tmpdir()` 下生成临时路径 `verbalcoding-codex-last-<pid>-<ts>.txt`。
2. 在最终 prompt 实参前插入 `--output-last-message <path>`。
3. 运行后读取该文件作为权威答案 (优先于 stdout)。
4. 删除临时文件。

即使 Codex 在 stdout 输出工具使用记录,语音回答仍来自抓取文件。

## 切到 Codex 的语音表述

- en: `"switch to Codex"`、`"ask Codex what it thinks"`
- zh: `"切到 Codex"`、`"问 Codex"`

## 坑

- **长任务。** 长达分钟级的代码生成需要 `AGENT_TASK_TIMEOUT_MS=0`。适配器尊重 `signal.aborted`,barge-in 切得干净。
- **无会话续接。** 用 `AGENT_PROJECT_CONTEXT` 传递上下文,路由变化后的连续性靠跨代理 handoff 块。
- **patch 输出安全。** 中断时若 Codex 正发 diff,bridge 不会朗读 diff,只播报 "已中断" 并提示查看文本频道。
- **认证。** OpenAI 后端 401 以非零退出;非默认后端时 fallback 提示改用默认代理。
