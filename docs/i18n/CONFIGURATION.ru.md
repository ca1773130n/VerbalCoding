# VerbalCoding Конфигурация

## Setup Wizard

Use upstream Discord-side guides first, then return to VerbalCoding:

- Hermes Agent Discord messaging guide: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord official bot overview: <https://docs.discord.com/developers/bots/overview>
- Discord official quick start: <https://docs.discord.com/developers/quick-start/getting-started>

```bash
vc setup --yes
# or from a clone
./scripts/install.sh
```

The installer asks for the Discord token, allowed users, auto-join voice channel names, transcript channel/thread, CLI harness backend, default voice language, TTS settings, and wake-word behavior. It writes `.env` with mode `0600`.

## Supported Agent Backends

Set `AGENT_BACKEND` in `.env`.

| Backend | Default command | Notes |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | Default; supports resume and verbose progress |
| `claude-code` / `claude` | `claude -p` | Override with `CLAUDE_COMMAND` or `AGENT_COMMAND` |
| `codex` | `codex exec` | Override with `CODEX_COMMAND` or `AGENT_COMMAND` |
| `gemini` | `gemini -p` | Override with `GEMINI_COMMAND` or `AGENT_COMMAND` |
| `opencode` | `opencode run` | Override with `OPENCODE_COMMAND` or `AGENT_COMMAND` |
| `openclaw` | `openclaw run` | Override with `OPENCLAW_COMMAND` or `AGENT_COMMAND` |
| `custom` | `AGENT_COMMAND` required | Prompt is appended as final argv |

Generic overrides:

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

## Example `.env`

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

## TTS Voice Selection

`vc language ko|en|auto` changes STT language, progress language, and default TTS voice. Live commands such as “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female`, and `switch speaker to English` change only the speaker/voice type.

Default Edge catalog:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | Language |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | Korean |
| `korean_female` | `ko-KR-SunHiNeural` | Korean |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | Korean |
| `english_male` | `en-US-GuyNeural` | English |
| `english_female` | `en-US-AriaNeural` | English |

Backend-specific voice options:

| Backend | Settings | Voice choices |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | Built-in types plus any `edge-tts --list-voices` voice |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`; `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | User-provided permitted reference WAV |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | Reference-sample voice or backend speaker/model ID |

## Utterance Segmentation

`UTTERANCE_IDLE_MS` controls how long the bridge waits after speech before starting STT. Default is `4500` ms.

```bash
UTTERANCE_IDLE_MS="4500"
UTTERANCE_IDLE_MS="6000"
```

## MCP Server

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

Tools: `status`, `doctor`, `set_auto_restart`, `set_language`, `start`, `stop`, and `restart`.

## Optional OpenVoice TTS

```bash
./scripts/setup_openvoice.sh
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

Only clone voices you own or have permission to use. OpenVoice falls back to Edge on failure.

## Optional Supertonic TTS

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

## Optional SpeechSwift / CosyVoice TTS

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

Recommended env includes `TTS_BACKEND="speechswift"`, `SPEECHSWIFT_MODE="server"`, `SPEECHSWIFT_ENGINE="cosyvoice"`, `SPEECHSWIFT_REF_AUDIO`, and `SPEECHSWIFT_SERVER_URL`. Keep Edge for quick progress prompts.

## Operational Notes

Enable Discord Message Content intent, grant voice connect/speak permissions, authenticate the selected CLI harness separately, and avoid reading diffs/log dumps aloud.
