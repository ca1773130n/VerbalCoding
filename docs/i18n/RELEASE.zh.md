# VerbalCoding 发行说明


## 最新 setup 流程

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

不要手动编辑 `.env`；使用 `vc setup token` 保存 `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`，使用 `vc setup channels` 保存 `AUTO_JOIN_VOICE_CHANNELS`。如果 Docker 中出现 `Cannot perform IP discovery - socket closed`，请在 Linux Compose 服务中使用 `network_mode: "host"` 并移除 `ports:`。

## 当前候选版本

VerbalCoding 是一个 Discord 语音桥接，用于通过语音控制基于 CLI 的编码代理。它面向公开发布，macOS / Apple Silicon 是测试最多的路径，并为常见包管理器提供尽力支持的 Linux 引导。

### 已包含

- 通过 Node `@discordjs/voice` 接收 Discord 语音。
- 通过 `whisper.cpp` + Metal 进行本地韩语 STT。
- 使用韩语默认声音进行 Edge TTS 播放。
- 通用 CLI 驱动适配器层：
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - 自定义命令
- Hermes 后端的共享语音/文本会话支持。
- 长答案 TTS 分块和响应式插话。
- Diff/code/log 保护机制，避免大段技术输出被朗读。
- 面向室内与嘈杂/户外使用的普通和保守灵敏度模式。
- 设置向导、`.env.example`、`vc doctor` 前置条件检查器，以及用于 OS 软件包、npm 依赖、Edge TTS 辅助环境和默认 whisper.cpp 模型的 `./scripts/install.sh --yes` 引导。
- npm 包安装路径：`npm install -g verbalcoding`、guided `vc setup` 和 `vc start`。
- 可选详细进度模式，在长时间代理工作期间提供仅文本的中间步骤更新。
- 常开 JSONL 延迟指标，以及用于流水线优化的 `!latency` / `!metrics` 摘要。
- 更耐心的发言空闲等待（`UTTERANCE_IDLE_MS=4500`），使带自然停顿的长口述指令不会被拆成部分提示加被忽略的处理期间语音。
- 多实例 Hermes profile 隔离：`vc instance setup <name>` 会自动将 Hermes profile 克隆到 `~/.hermes/profiles/<name>`，设置实例 workdir，初始化 SOUL.md，并将 `HERMES_HOME` 写入实例 env，使每项目记忆和 skills 保持分离；`vc instance start` 会自愈缺失 profile，`vc doctor` 会检查 profile 目录存在性和 `terminal.cwd` 一致性。

### 预发布检查清单

从仓库根目录运行：

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # 需要 Docker；验证 ubuntu:24.04 干净安装
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # 没有 Python 测试时也可以
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

手动冒烟测试：

1. 使用 `vc start` 或 `./run.sh` 启动桥接。
2. 验证日志包含 `Logged in as <bot-name>`。
3. 验证日志包含 `Listening in voice channel ... / 일반` 或已配置的默认频道。
4. 在 Discord 中运行 `!ping`。
5. 在 Discord 语音中说一个简短韩语请求。
6. 验证 STT 转写、代理响应、TTS 播放和插话行为。

### 已知要求

- macOS + Homebrew，或带 `apt`、`dnf`、`pacman` 的 Linux（用于尽力支持的引导）。
- `ffmpeg`；安装器会尝试安装它。
- `whisper-cli`；安装器在 macOS 使用 Homebrew，在 Linux 上回退到本地 `vendor/whisper.cpp` 构建。
- 默认模型位于 `models/ggml-small-q5_1.bin`；除非使用 `--skip-model`，安装器会下载它。
- `PATH` 上的 Edge TTS CLI，或本地 `.venv-tts/bin/edge-tts`；安装器会在需要时创建本地辅助环境。
- `.env`、`instances/<name>.env`、`~/.zshrc` 或运行时 env 中的 Discord 机器人令牌。
- 已安装并认证的所选 CLI 驱动。

### 尚不适合公开发布

公开发布前，建议添加：

- GitHub Actions CI。
- 演示视频 / GIF。
- Discord 机器人设置截图。
- 在脚本级检查之外，对真实发行版进行更广泛的 Linux 验证。
- 对所有日志路径进行安全审查。
