# VerbalCoding 使用指南


## 最新 setup 流程

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

不要手动编辑 `.env`；使用 `vc setup token` 保存 `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`，使用 `vc setup channels` 保存 `AUTO_JOIN_VOICE_CHANNELS`。如果 Docker 中出现 `Cannot perform IP discovery - socket closed`，请在 Linux Compose 服务中使用 `network_mode: "host"` 并移除 `ports:`。

本页面保存曾经让 README 过长的运维细节。

## CLI 命令

```bash
vc status                    # 显示 STT 语言、进度语言和 TTS 声音
vc language en               # 英语 STT + 英语进度/TTS 声音
vc language ko               # 韩语 STT + 韩语进度/TTS 声音
vc language auto             # Whisper 自动检测 STT + 英语进度/TTS 声音
vc restart auto status       # 显示提交时语音机器人自动重启设置
vc restart auto on           # 启用提交时语音机器人自动重启
vc restart auto off          # 禁用它；这是默认值
vc bot invite CLIENT_ID      # 打印带所需权限的 Discord 邀请 URL
vc instance status           # 列出每实例桥接配置和进程状态
vc instance setup NAME       # 写入 instances/NAME.env 并创建 ~/.hermes/profiles/NAME
vc instance start NAME       # 分离启动 ./run.sh instances/NAME.env
vc instance stop NAME        # 停止分离的实例并移除其 pid 文件
vc doctor                    # 运行脱敏 doctor 检查
npm run mcp                  # 运行 stdio MCP 服务器
```

语言更改会更新 `.env`；请使用 `./run.sh` 或你的进程管理器重启桥接，让更改生效。

## 运行模式

单实例桥接：

```bash
./run.sh
```

使用本地覆盖 env 的每实例桥接：

```bash
./run.sh instances/my-project.env
# 或
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

机器人会自动加入第一个已配置的频道名称，默认是 `일반,General,general`。

## Discord 命令

在接线命令之前，请使用上游指南设置 Discord 应用/机器人：

- Hermes Agent Discord 指南：<https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 官方机器人文档：<https://docs.discord.com/developers/bots/overview>

然后使用 `vc bot invite CLIENT_ID` 生成带文本和语音权限的 VerbalCoding 专用邀请 URL。

| 命令 | 用途 |
|---|---|
| `!ping` | 基本机器人检查 |
| `!join` / `!leave` | 加入或离开语音 |
| `!say <text>` | 直接通过 TTS 朗读文本 |
| `!voice-test <text>` | 测试当前 TTS 后端/声音 |
| `!voice-clone capture` | 将下一个有效发言保存为 OpenVoice 参考样本 |
| `!voice-clone status` / `!voice-clone cancel` | 查看或取消采集 |
| `!ask <prompt>` | 通过与语音相同的已选择驱动适配器发送文本 |
| `!session status` | 显示当前项目/默认适配器会话 |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | 创建项目范围的 Hermes 会话 |
| `!session attach-voice [sessionName] --voice <voice-channel>` | 将文本频道/thread 绑定到语音频道 |
| `!session list` | 列出已配置的项目会话 |
| `!session reset` / `!reset-session` | 清除当前项目/默认适配器会话文件 |
| `!verbose on/off` | 切换详细进度更新 |
| `!latency` / `!metrics` | 显示最近延迟摘要 |
| `!sensitivity normal/conservative` | 切换插话灵敏度 |

桥接会处理诸如“외부 모드”、“보수 모드”、“실내”、“기본 감도”等语音等价命令，以及“잠깐”、“멈춰”、“그만”等明确停止短语。你也可以说“상세 진행 켜” / “상세 진행 꺼”来通过语音切换详细进度。

## 更改声音

`vc language ko|en|auto` 会同时更改 STT 语言、进度语言和匹配的默认 TTS 声音。如果只想在桥接运行时更换说话人/声音，请在 Discord 语音中说：

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

实时桥接会将这些识别为语音控制命令，更新 `config/tts-voices.json`，更新运行进程的有效 TTS env，并用类似“목소리를 Korean male로 바꿨어.”的简短确认作答。更改后立即使用 `!voice-test <text>` 来听当前后端和声音。

内置 Edge 声音类型：

| 声音类型 | Edge 声音 |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

对于持久手动配置，请在 `.env` 中设置 `TTS_BACKEND=edge`、`TTS_VOICE_TYPE=<voice-type>`，并可选设置 `TTS_VOICE=<edge-voice>`；也可以编辑 `config/tts-voices.json` 以使用自定义声音目录。

后端专用声音旋钮：

| 后端 | 声音设置 | 常见选择 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female`；来自 `edge-tts --list-voices` 的任何 Edge 声音 |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`；设置 `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | 获准使用的参考 WAV，以及如 `default` 的风格 |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | CosyVoice 的参考 WAV，或后端支持的说话人/模型值 |

对于 Supertonic 和本地克隆后端，请使用上面的后端 env vars 加 `!voice-test <text>` 来试听更改。语音命令切换目前映射到内置 Edge 风格声音类型；更丰富的后端目录可以添加到 `config/tts-voices.json`。

## 长听写和停顿

VerbalCoding 会等待一个空闲窗口后再把语音发送给 STT。默认 `UTTERANCE_IDLE_MS=4500` 有意稍微耐心一些，这样长指令中的自然停顿不会拆分句子、过早启动代理轮次，并把剩余语音当作处理期间的打断。

如果你偏好更快的短命令，请在 `.env` 中降低它；如果长韩语听写仍被拆分，请提高它：

```bash
UTTERANCE_IDLE_MS="6000"
```

## 详细进度模式

除非设置了 `AGENT_VERBOSE_PROGRESS=1`，详细进度默认关闭。可用 `!verbose on` 或“상세 진행 켜”等语音命令启用。它可以输出如下简短进度行：

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

该模式会要求所选 CLI 驱动输出 `VERBALCODING_PROGRESS: ...` 行，并在可用时汇总流式 stdout/stderr 中的常见工具标记。看起来像密钥的字段会被脱敏，进度行会从最终朗读答案中移除。

## 延迟指标

VerbalCoding 会按轮次将延迟记录写为 JSONL。默认路径：

```text
./.logs/latency.jsonl
```

每条记录包含状态、总耗时、语音采集时间、发言空闲等待、STT 时间、代理时间、TTS 合成/播放时间、分块数量、转写长度、答案长度，以及可用时的音频电平。

在 Discord 中：

```text
!latency
!metrics
```

摘要使用最新 200 条记录：数量、平均值、p95、最大值和非 OK 状态。

## 测试

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` 会有意脱敏密钥，并只报告必需值是否已配置。它还会检查 `instances/*.env` 中是否存在重复令牌指纹和冲突的运行时路径。
