# 全新安装

本指南用于干净的公开安装。它避免依赖本地专用假设，并使用安装器尽可能完成引导。

## 1. 安装 CLI

推荐的 npm 路径：

```bash
npm install -g verbalcoding
```

或者直接运行已发布的软件包：

```bash
npx verbalcoding setup --yes
```

如果你使用了 `npm install -g`，继续运行：

```bash
vc setup --yes
```

贡献者的 GitHub 克隆路径：

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. 引导依赖并运行设置向导

通过 npm 安装时，当前目录中没有仓库检出，因此不要直接运行 `./scripts/install.sh`。请改用打包好的 CLI 包装器：

```bash
vc setup --yes
```

`vc setup` 会运行已安装 npm 包内部的 `scripts/install.sh`。只有在 GitHub 克隆目录中时才使用 `./scripts/install.sh --yes`：

```bash
./scripts/install.sh --yes
```

它会执行以下操作：

- 当缺少 `node_modules/` 时安装 npm 依赖，
- 使用 `npm link` 安装简短的 `vc` shell 命令，
- 在 OS 包管理器支持时安装 `ffmpeg`、Node/npm 和 `whisper-cli`，
- 下载 `models/ggml-small-q5_1.bin`，
- 当 `PATH` 上尚无 `edge-tts` 时创建 `.venv-tts` 并安装 `edge-tts`，
- 运行交互式 `.env` 向导。

支持的系统引导路径：

| OS | 系统依赖路径 |
|---|---|
| macOS | Homebrew：按需执行 `brew install node ffmpeg whisper-cpp` |
| Debian/Ubuntu | 使用 `apt-get` 安装 Node/npm、ffmpeg、Python、构建工具；本地 whisper.cpp 构建回退 |
| Fedora/RHEL | 使用 `dnf` 安装 Node/npm、ffmpeg、Python、构建工具；本地 whisper.cpp 构建回退 |
| Arch | 使用 `pacman` 安装 Node/npm、ffmpeg、Python、构建工具；本地 whisper.cpp 构建回退 |

有用的安装器变体：

```bash
vc setup --yes --no-wizard                   # 仅从 npm 安装进行依赖/引导
./scripts/install.sh --yes --no-wizard       # 仅从克隆仓库进行依赖/引导
./scripts/install.sh --skip-system           # 不安装 OS 软件包
./scripts/install.sh --skip-model            # 不下载默认 STT 模型
./scripts/install.sh --skip-edge-tts         # 不创建 .venv-tts
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

如果你的 OS 不受支持，请先手动安装以下内容，再重新运行：

- Node.js 20+ 和 npm
- ffmpeg
- 带 venv/pip 的 Python 3
- whisper.cpp `whisper-cli`
- 一个已认证的 CLI 代理后端，默认是 Hermes Agent

## 3. Discord 应用设置

如果这是你的第一个机器人，请先阅读上游 Discord 机器人设置指南：

- Hermes Agent Discord 消息指南：<https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 官方机器人概览：<https://docs.discord.com/developers/bots/overview>
- Discord 官方入门指南：<https://docs.discord.com/developers/quick-start/getting-started>

这些页面展示如何创建 Discord 应用、添加机器人用户、启用特权 intents，并邀请它加入服务器。VerbalCoding 使用同样的 Discord 机器人设置，然后在其上增加语音接收、STT、CLI 代理执行和 TTS 播放。

1. 在 Discord Developer Portal 中创建 Discord 应用和机器人。
2. 启用 Message Content 特权 intent。
3. 将机器人令牌复制到安装器提示或 `.env` 中的 `DISCORD_BOT_TOKEN`。
4. 生成邀请 URL：

```bash
vc bot invite <discord-client-id>
# 或将它固定到一个服务器：
vc bot invite <discord-client-id> --guild <guild-id>
```

该邀请包含 VerbalCoding 使用的 bot 和 slash-command scopes，以及文本/语音权限。

## 4. 验证

```bash
vc doctor
```

`vc doctor` 会脱敏输出：它报告缺失的令牌/命令/模型，但不会打印密钥值。修复每个 `✗` 项，然后重新运行。

预期成功输出包括：

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

如果安装器创建了本地 Edge TTS 辅助环境，`.env` 应包含指向 `.venv-tts/bin/edge-tts` 的 `EDGE_TTS_COMMAND` 路径。

## 5. 运行单个默认机器人

```bash
vc start
# 或者，从 GitHub 克隆仓库中：
./run.sh
```

成功启动日志包括：

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

在 Discord 中：

```text
!ping
!join
!ask say hello briefly
!verbose on
```

然后在已配置的语音频道中说话。你应该会看到 STT 文本、详细模式开启时的进度文本、最终文本答案，并听到 TTS 播放。

## 6. 每个项目一个房间的设置

如果希望每个项目语音房间都有一个长期机器人，请为每个项目创建一个 Discord 应用，然后运行：

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

每个实例都会写入一个被忽略的 `instances/<name>.env`，其中包含自己的令牌、语音频道、转写目标、日志路径、Hermes 会话文件和可选 Hermes profile。

## 7. 可选 OpenVoice 设置

OpenVoice 语音克隆是可选的。全新公开安装请保留 `TTS_BACKEND=edge`。之后若要启用 OpenVoice：

```bash
./scripts/setup_openvoice.sh
# 将 OpenVoice V2 checkpoints 下载到 vendor/OpenVoice/checkpoints_v2/
# 在 voice-samples/user-reference.wav 放入一个获准使用的本地样本，
# 或运行机器人，说“목소리 샘플 녹음 시작해”，然后说话 10-30 秒。
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

然后设置 `TTS_BACKEND=openvoice`，运行 `vc doctor`，并在 Discord 中测试 `!voice-test <text>`。

## 8. 维护者的干净克隆冒烟测试

快速的仅主机冒烟测试：

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

此时预期失败应是缺少本地密钥或未认证的代理 CLI，而不是令牌泄漏或安装脚本缺失。

基于 Docker 的 Ubuntu 干净安装冒烟测试：

```bash
./scripts/docker_ubuntu_smoke.sh
```

它会运行 `ubuntu:24.04`，将已跟踪的仓库树复制到干净容器中，执行 `./scripts/install.sh --yes --no-wizard`，写入无密钥的冒烟 `.env`，检查 `vc`，运行 Node 测试，并验证 `vc doctor`。它不会连接 Discord 语音；如果需要端到端语音频道测试，请在此之后使用真实 Ubuntu VM 或 WSL2。
