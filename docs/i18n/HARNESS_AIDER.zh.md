# Aider — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

Aider 是专注于直接编辑文件的结对编程 AI CLI。VerbalCoding 通过 `aider --no-pretty --yes-always --message` 驱动 — prompt 作为 `--message` 的值传入,每个语音 turn 都是一次可能直接修改 `AGENT_WORKDIR` 中文件的非交互 Aider 运行。

## 安装

```bash
pip install aider-chat
aider --version
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider 需要所用模型对应的 API key (OpenAI / Anthropic / 本地服务器)。详见 <https://aider.chat>。

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=aider
AIDER_COMMAND="aider --no-pretty --yes-always --message"   # 默认
AGENT_WORKDIR=/Users/you/code/your-project                 # Aider 编辑的目录
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000                               # Aider 通常更久
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty` 去掉 Rich 框字符以免卡住流式 sentencer。`--yes-always` 保持非交互 (Aider 不再因 "应用此 diff?" 提示停下)。

## 切到 Aider 的语音表述

- en: `"switch to Aider"`、`"ask Aider to ..."`
- zh: `"切到 Aider"`、`"让 Aider 处理"`

别名: `aider`。

## 坑

- **Aider 会改文件。** 与 `-p` 模式下的 Claude / Codex / Gemini 不同,Aider 在回答时直接修改工作树。慎选 `AGENT_WORKDIR` — 通常用项目会话的 `workdir`。
- **输出含 diff。** Aider 经常输出 diff 形态文本。turn 被中断时 bridge 只播报 "已中断",不朗读 diff — 用文本频道与 `git status` 确认。
- **认证。** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` 必须在 Aider 环境中;实例隔离常用 `instances/<project>.env`。
- **按频道状态。** 跨代理路由按 Discord 频道隔离,在某个项目房间切到 Aider 不影响其它房间。
