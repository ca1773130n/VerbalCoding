# Hermes Agent — Harness 说明

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="HARNESSES.zh.md">Harness</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a>
</p>

Hermes Agent 是 VerbalCoding 的默认后端,也是唯一拥有真正会话续接契约的 harness。turn 之间上下文保持干净。关于 Hermes 内建 `/voice` 的对比,见 [HERMES_VOICE.zh.md](./HERMES_VOICE.zh.md)。

## 安装

参考上游 Hermes Agent 安装指引: <https://hermes-agent.nousresearch.com>。

先确认 CLI 单独可用:

```bash
hermes chat -Q -q "hello"
```

## VerbalCoding 配置

```bash
# .env
AGENT_BACKEND=hermes
# 可选
HERMES_COMMAND="hermes chat -Q -q"           # 默认
HERMES_HOME=/Users/you/.hermes               # 每实例 Hermes 主目录
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0                     # 0 = 不限
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

会话文件默认 `<repo>/.verbalcoding-session` (用 `HERMES_SESSION_FILE` 覆盖)。

## 会话续接

Hermes 是内建适配器中唯一支持会话续接的。每次成功 turn 后适配器将新 `session_id` 写入磁盘,下次调用前置 `--resume <id>`。`!session reset` (或 `!reset-session`) 清除。

若 Hermes 在 stderr 输出 `session_id:` 之前被 abort,适配器会读取 `~/.hermes/sessions/session_<id>.json` 找回最后一条助手消息。

## 详细进度

详细模式下,适配器去掉 Hermes 的 `-Q` 静默标志,stdout 会流出 `┊ <emoji> <tool>` 预览,被汇总为一行进度事件 (文件读取、网页搜索、终端执行等)。非详细模式只把最终框内回答念出。

## 切到 Hermes 的语音表述

- en: `"switch to Hermes"`、`"ask Hermes ..."`
- zh: `"切到 Hermes"`、`"问 Hermes"`

## 坑

- 跨代理切换时的 TTS 前缀按语言: `"Hermes says: "` / `"Hermes:"`。
- `HERMES_HOME` 是最常用的项目级隔离开关。实例 `.env` 通常设 `HERMES_HOME=/Users/you/.hermes/profiles/<project>`。
- 详细模式开启但 Hermes 以空框结束 (超时) 时,适配器会在放弃前抓会话 JSON 找最终回答。
