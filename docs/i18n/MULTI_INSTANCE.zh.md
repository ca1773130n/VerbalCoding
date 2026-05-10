# 多实例 VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.zh.md">README</a> ·
  <a href="README.zh.md">文档中心</a> ·
  <a href="FRESH_INSTALL.zh.md">Fresh Install</a> ·
  <a href="USAGE.zh.md">Usage</a> ·
  <a href="CONFIGURATION.zh.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.zh.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.zh.md">Multi-Instance</a>
</p>

> 最快路径: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

## 最新 setup 流程

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

不要手动编辑 `.env`；使用 `vc setup token` 保存 `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`，使用 `vc setup channels` 保存 `AUTO_JOIN_VOICE_CHANNELS`。如果 Docker 中出现 `Cannot perform IP discovery - socket closed`，请在 Linux Compose 服务中使用 `network_mode: "host"` 并移除 `ports:`。

VerbalCoding 可以运行多个相互独立的 Discord 语音桥接进程。每个进程仍然是现有的单实例 Node 桥接，但会加载不同的 `instances/<name>.env` 文件，并使用不同的 Discord 机器人令牌。

当每个项目都应长期占用自己的 Discord 语音频道，并写入自己的转写频道/thread 时，请使用此模式。

## 为什么需要多个机器人令牌

Discord 语音驻留实际上是每个机器人账号在每个 guild 中只能有一个活动语音连接。如果一个机器人令牌加入同一 guild 中的另一个语音频道，它就无法同时永久保持连接到先前的频道。若要同时使用多个项目房间，请为每个项目创建一个 Discord 应用/机器人。

## 文件布局

```text
instances/
  README.md
  example.env
  llm-wiki.env        # 仅本地，git 忽略
  verbalcoding.env    # 仅本地，git 忽略
.run/instances/
  llm-wiki.pid        # 仅运行时，git 忽略
```

真实的 `instances/*.env` 文件会被忽略，因为它们可能包含 Discord 令牌。`instances/example.env` 是已提交的模板。

## 实例设置向导

正常使用时，用户不应复制并手动编辑 env 文件。请运行向导：

```bash
vc instance setup llm-wiki
# 或通过项目设置脚本：
./scripts/install.sh --instance llm-wiki
```

向导会提示输入机器人令牌、Discord Application/Client ID、语音频道、转写目标、workdir、项目上下文和隔离的运行时路径。它会以 `0600` 模式写入 `instances/<name>.env`，在覆盖现有文件前先备份，并打印下一步 start/status 命令。

如果你在设置期间输入 Discord Application/Client ID，摘要也会打印该机器人的邀请 URL。你可以随时用以下命令生成同一 URL：

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

Discord 仍然要求每个同时存在的语音房间都有一个 Developer Portal 应用/机器人，但这可以避免手动构造 OAuth URL 或权限整数。

### Hermes profile 隔离

每个实例都会在 `~/.hermes/profiles/<name>` 获得自己的 Hermes home，因此 memory、MEMORY.md、SOUL.md 和已学习 skills 不会在项目之间泄漏。

`vc instance setup <name>` 会自动：

- 运行 `hermes profile create <name> --clone-from default`（从当前 `~/.hermes` 带入 API keys 和模型；会话与记忆从空白开始），
- 将新 profile 的 `terminal.cwd` 设置为实例 workdir，
- 使用向导中的项目上下文答案初始化 `<profile>/SOUL.md`，
- 将 `HERMES_HOME=...` 写入 `instances/<name>.env`。

`vc instance start <name>` 会自愈：如果 env 指向的 Hermes profile 目录不再存在，start 命令会在启动前重新创建它。

实例名称必须匹配 `^[a-z0-9][a-z0-9_-]{0,63}$`，因为 Hermes 会将该名称用作目录和配置键。

## 最小生成实例 env

```env
INSTANCE_NAME=my-project
DISCORD_TOKEN=replac...oken
DISCORD_CLIENT_ID=123456789012345678
AUTO_JOIN_VOICE_CHANNELS=Project Room
TRANSCRIPT_CHANNEL_ID=123456789012345678
PROJECT_SESSIONS_FILE=config/project-sessions.my-project.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-my-project.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-my-project-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/my-project.session
HERMES_HOME=/home/you/.hermes/profiles/my-project
AGENT_LABEL=VerbalCoding · My Project
AGENT_CWD=/path/to/my-project
AGENT_PROJECT_CONTEXT=Project session: My Project
```

请为每个实例提供唯一的日志/debug/会话文件值。`HERMES_HOME` 和匹配的 `~/.hermes/profiles/<name>` 目录会由 `vc instance setup` 自动创建。`vc doctor` 会检查重复令牌、冲突的运行时路径、缺失的 profile 目录，以及 profile 与实例之间的 `terminal.cwd` 不匹配——且不会打印密钥。

## 命令

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start` 会分离运行 `./run.sh instances/<name>.env`，并写入 `.run/instances/<name>.pid`。

`stop` 会发送 `SIGTERM`，最多等待 10 秒，然后回退到 `SIGKILL` 并移除 pid 文件。

## 示例：两个长期语音房间

1. 创建两个 Discord 应用/机器人：
   - VerbalCoding bot
   - LLM-Wiki bot

2. 使用文本和语音权限邀请两者加入服务器：
   - View Channel
   - Send Messages
   - Send Messages in Threads
   - Read Message History
   - Use Application Commands
   - Connect
   - Speak

   创建每个 Discord 应用后，使用 `vc bot invite <client-id>` 打印带这些权限的精确邀请 URL。

3. 为每个本地实例运行设置向导：

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

向导会以 `0600` 模式写入被忽略的 `instances/verbalcoding.env` 和 `instances/llm-wiki.env` 文件；它还会在替换前备份现有实例 env。每次运行还会从你的默认 Hermes home 克隆创建 `~/.hermes/profiles/<name>`，因此两个实例起始时具有相同 auth/model，但随着学习各自项目，会累积独立的记忆和 skills。

4. 检查配置：

```bash
vc doctor
```

5. 启动两者：

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. 验证日志：

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

预期日志行：

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. 停止两者：

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## 短期单机器人文本/语音绑定

如果你只有一个机器人令牌，请使用项目会话语音绑定，而不是同时驻留多个频道。

在目标文本频道/thread 中运行：

```text
!session attach-voice --voice "LLM-Wiki"
```

行为：

- 将所选语音频道绑定到当前文本频道/thread。
- 如果当前文本频道没有项目会话，则创建一个临时隔离会话。
- 语音 STT/结果/进度/最终答案文本会路由到该活动项目的转写目标。

若要附加现有命名项目会话：

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

这对路由很方便，但不会让一个机器人同时停留在两个语音频道中。若要同时长期驻留，请使用多个机器人令牌/进程。
