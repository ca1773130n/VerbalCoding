# VerbalCoding 配置


## 最新 setup 流程

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

不要手动编辑 `.env`；使用 `vc setup token` 保存 `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`，使用 `vc setup channels` 保存 `AUTO_JOIN_VOICE_CHANNELS`。如果 Docker 中出现 `Cannot perform IP discovery - socket closed`，请在 Linux Compose 服务中使用 `network_mode: "host"` 并移除 `ports:`。

## 设置向导

这里有意不从头重新解释 Discord 机器人/应用设置。请先使用这些上游指南完成 Discord 侧步骤，然后回到 VerbalCoding 设置：

- Hermes Agent Discord 消息指南：<https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 官方机器人概览：<https://docs.discord.com/developers/bots/overview>
- Discord 官方快速开始：<https://docs.discord.com/developers/quick-start/getting-started>

```bash
./scripts/install.sh
```

安装器会询问 Discord 令牌、允许的用户、自动加入的语音频道名称、转写频道/thread、CLI 驱动后端、默认语音语言、TTS 设置和唤醒词行为。它会以 `0600` 模式写入 `.env`；`.env` 会被 git 忽略。它还会链接简短的 shell 命令 `vc`。

如果你在手动安装后只需要 shell 命令：

```bash
npm link
```

## 支持的代理后端

在 `.env` 中设置 `AGENT_BACKEND`。

| 后端 | 默认命令 | 说明 |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | 默认。保留 `.verbalcoding-session` 恢复行为。 |
| `claude-code` / `claude` | `claude -p` | 用 `CLAUDE_COMMAND` 或 `AGENT_COMMAND` 覆盖。 |
| `codex` | `codex exec` | 用 `CODEX_COMMAND` 或 `AGENT_COMMAND` 覆盖。 |
| `gemini` | `gemini -p` | 用 `GEMINI_COMMAND` 或 `AGENT_COMMAND` 覆盖。 |
| `opencode` | `opencode run` | 用 `OPENCODE_COMMAND` 或 `AGENT_COMMAND` 覆盖。 |
| `openclaw` | `openclaw run` | 用 `OPENCLAW_COMMAND` 或 `AGENT_COMMAND` 覆盖。 |
| `custom` | 必需的 `AGENT_COMMAND` | 提示会作为最终 argv 参数追加。 |

通用覆盖：

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=4500
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## 代理适配器契约

语音桥接通过一个适配器契约与每个后端通信：

- `run({ text }, signal, plan)` 返回状态、最终答案文本、后端标签、耗时，以及可选会话元数据。
- `ask(text, signal, plan)` 是兼容性快捷方式，只返回最终答案文本。
- `capabilities` 声明后端是否支持会话恢复、流式进度和取消。
- Hermes 是参考适配器：会话恢复、详细进度流、取消，以及从 Hermes 会话文件恢复最终答案。

新后端应实现同一契约，并将语音/STT/TTS 行为保留在适配器外部。

## `.env` 示例

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_female"
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="4500"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## TTS 声音选择

语言预设和声音选择是分开的：

- `vc language ko|en|auto` 会更改 STT 语言、进度语言和该语言的默认声音。
- “남자 한국어 목소리로 바꿔”、“여자 한국어 목소리로 바꿔”、`change voice to Korean female` 和 `switch speaker to English` 等实时语音命令只更改说话人/声音类型。
- `!voice-test <text>` 会用当前选择的后端和声音播放快速样本。

默认情况下，声音选择保存在 `config/tts-voices.json` 中。可用 `TTS_VOICE_CONFIG` 覆盖路径。运行中的桥接会在合成前重新读取/应用声音选择，因此语音命令无需完整重启即可生效。

默认 Edge 目录：

| `TTS_VOICE_TYPE` | `TTS_VOICE` | 语言 |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | 韩语 |
| `korean_female` | `ko-KR-SunHiNeural` | 韩语 |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | 韩语 |
| `english_male` | `en-US-GuyNeural` | 英语 |
| `english_female` | `en-US-AriaNeural` | 英语 |

手动持久覆盖：

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

对于 OpenVoice、SpeechSwift 或 Supertonic，请保留下方各节中的后端专用声音/参考设置；同一个声音目录文件仍可跟踪当前活动声音类型。

后端专用声音选项：

| 后端 | 设置 | 声音选择 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | 上述内置类型，以及 `edge-tts --list-voices` 返回的任何声音 |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`；语言 `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | 用户提供且获准使用的参考 WAV；风格默认 `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | CosyVoice 的参考样本声音，或后端支持的说话人/模型 ID |

## 发言分段

`UTTERANCE_IDLE_MS` 控制桥接在语音片段后等待多久，才判定用户说完并启动 STT。默认值是 `4500` ms，用于保留带自然停顿的较长口述指令。较低值让短命令感觉更快，但可能拆分长听写；较高值更适合需要思考停顿的语音。

```bash
UTTERANCE_IDLE_MS="4500"  # 平衡默认值
UTTERANCE_IDLE_MS="6000"  # 对带停顿的长听写更安全
```

## MCP 服务器

VerbalCoding 附带一个 stdio MCP 服务器，因此 Hermes Agent 或任何 MCP 客户端都可以通过工具控制桥接，而不必依赖 skills 或自由形式 shell 命令。

Hermes 配置示例：

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

暴露的 MCP 工具：

| 工具 | 用途 |
|---|---|
| `status` | 在不暴露密钥的情况下报告桥接/配置状态 |
| `doctor` | 运行脱敏 doctor 检查 |
| `set_auto_restart` | 启用/禁用提交时语音机器人自动重启 |
| `set_language` | 同时更新 STT/进度/TTS 语言 |
| `start`, `stop`, `restart` | 控制 Discord 语音桥接 |

## 可选 OpenVoice TTS

Edge TTS 仍是默认值和回退。若要尝试使用 OpenVoice V2 进行本地语音克隆：

```bash
./scripts/setup_openvoice.sh
# 从 OpenVoice 文档下载 checkpoints_v2_0417.zip，并解压到 vendor/OpenVoice/checkpoints_v2/
mkdir -p voice-samples
# 将获准使用的参考样本放到 voice-samples/user-reference.wav，
# 或在 Discord 中用 !voice-clone capture 采集一个。
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

然后设置：

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

只克隆你拥有或获准使用的声音。如果 OpenVoice 失败或超时，VerbalCoding 会回退到 Edge TTS。

## 可选 Supertonic TTS

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

然后设置：

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

如果 Supertonic 缺失、失败或超时，VerbalCoding 会回退到 Edge TTS。

## 可选 SpeechSwift / CosyVoice TTS

在 Apple Silicon 上，`speech-swift` 是一个用于韩语语音克隆的本地后端，基于 MLX 原生 CosyVoice/Qwen3-TTS。

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

推荐 env：

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"
SPEECHSWIFT_ENGINE="cosyvoice"
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"
```

保留 Edge 用于快速进度/回声提示。

## 运维说明

- 机器人需要启用 Discord 特权 Message Content intent 才能使用文本命令。
- 机器人需要语音频道连接/发言权限。
- 对于 Hermes Agent，请在默认 profile 上正常配置/认证 Hermes（`hermes setup`、`hermes login` 等）。
- 对于 Claude Code、Codex、Gemini、OpenCode、OpenClaw，请分别安装并认证这些 CLI。
- 如果某个 CLI 在超时或信号失败时输出 diff/code，桥接会避免朗读它，而改为发送详细文本。
