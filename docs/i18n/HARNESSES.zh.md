# 编码代理 Harness

<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="README.zh.md">文档中心</a> ·
  <a href="USAGE.zh.md">使用</a> ·
  <a href="CONFIGURATION.zh.md">配置</a> ·
  <a href="TROUBLESHOOTING.zh.md">排错</a>
</p>

VerbalCoding 与代理无关。它会驱动你安装的任意 CLI 编码代理:每次语音 turn 启动它一次,把 STT 后的发言作为 prompt 传入,再把回答念回来。选**一个**作为默认,跨代理语音路由让你临时切换到其它代理。

| Harness | 默认命令 | 会话续接 | Harness 专用文档 |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.zh.md](./HERMES_VOICE.zh.md) · [HARNESS_HERMES.zh.md](./HARNESS_HERMES.zh.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.zh.md](./HARNESS_CLAUDE.zh.md) |
| Codex | `codex exec` | ❌ (末条消息文件抓取) | [HARNESS_CODEX.zh.md](./HARNESS_CODEX.zh.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.zh.md](./HARNESS_GEMINI.zh.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.zh.md](./HARNESS_OPENCODE.zh.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.zh.md](./HARNESS_OPENCLAW.zh.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.zh.md](./HARNESS_AIDER.zh.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.zh.md](./HARNESS_CURSOR.zh.md) |

## 选择默认代理

`vc setup` 会自动检测已安装的二进制并让你选择。非交互方式:

```bash
# .env 或 instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

每个 harness 从对应同名 env (`HERMES_COMMAND`、`CLAUDE_COMMAND` 等) 读取自己的命令。共享 env (`AGENT_LABEL`、`AGENT_COMMAND`、`AGENT_SESSION_FILE`、`AGENT_WORKDIR`、`AGENT_PROJECT_CONTEXT`、`AGENT_TASK_TIMEOUT_MS`、`AGENT_CHAT_TIMEOUT_MS`、`AGENT_VERBOSE_PROGRESS`) 会覆盖各 harness 默认值。

## 通过语音在 harness 之间路由

配置好后无需重启即可路由到任意**已安装**的 harness:

- `"ask Codex what it thinks"` — 单 turn 路由,下一个 turn 自动回默认。
- `"switch to Aider"` — 粘性路由,直到说 `"back to default"`。
- 计划模式 `which_agent` 槽 — 代理自身建议下一个计划由哪个后端执行。

路由层会检测二进制是否在 `PATH` (相对路径按活动项目会话的 workdir 解析);若未安装,bridge 会问 `"用默认代理代替进行?"` — 回答 `"yes"` 转默认,`"no"` 取消。

解析器识别的别名: `claude` / `claude code`、`codex` / `科德克斯`、`gemini` / `gemini cli`、`opencode`、`openclaw`、`aider`、`cursor` / `cursor cli`、`hermes`。

## 共享语义

所有 harness 适配器一致遵守的:

- **语音计划模式** — `"plan it first"` 生成计划,语音编辑,`"approve"` 用选定的 harness 执行。
- **打断** — barge-in 立即切断当前 TTS 并 abort 代理任务。粘性路由在打断后保留,只清除单 turn 路由。
- **详细进度** — `AGENT_VERBOSE_PROGRESS=1` (或语音命令) 输出 harness 发出的进度事件。配置 `SMART_PROGRESS_API_KEY` 后,LLM 摘要器每批合成一句。
- **推送通知** — `NOTIFY_PROVIDER=ntfy|pushover` + `NOTIFY_MIN_TASK_MS` 条件成立且语音频道为空时推送。按 body + `NOTIFY_DEBOUNCE_MS` 去抖。
- **按频道状态** — 每个 Discord 语音频道单独维护路由、计划状态、发言环形缓冲。
- **项目会话** — `!session new <name> <workdir>` 将频道绑定到项目。(harness, session) 适配器缓存,rebind 时失效。

各 harness 安装路径、认证、坑请见各自文档。env 完整参考: `docs/CONFIGURATION.zh.md`。
