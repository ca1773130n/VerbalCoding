# VerbalCoding Configuration

## Setup Wizard

```bash
./scripts/install.sh
```

The installer asks for Discord token, allowed users, auto-join voice channel names, transcript channel/thread, CLI harness backend, default voice language, TTS settings, and wake-word behavior. It writes `.env` with mode `0600`; `.env` is ignored by git. It also links the short shell command `vc`.

If you only need the shell command after manual install:

```bash
npm link
```

## Supported Agent Backends

Set `AGENT_BACKEND` in `.env`.

| Backend | Default command | Notes |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | Default. Preserves `.verbalcoding-session` resume behavior. |
| `claude-code` / `claude` | `claude -p` | Override with `CLAUDE_COMMAND` or `AGENT_COMMAND`. |
| `codex` | `codex exec` | Override with `CODEX_COMMAND` or `AGENT_COMMAND`. |
| `gemini` | `gemini -p` | Override with `GEMINI_COMMAND` or `AGENT_COMMAND`. |
| `opencode` | `opencode run` | Override with `OPENCODE_COMMAND` or `AGENT_COMMAND`. |
| `openclaw` | `openclaw run` | Override with `OPENCLAW_COMMAND` or `AGENT_COMMAND`. |
| `custom` | required `AGENT_COMMAND` | Prompt is appended as the final argv argument. |

Generic overrides:

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=2000
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## Agent Adapter Contract

The voice bridge talks to every backend through one adapter contract:

- `run({ text }, signal, plan)` returns status, final answer text, backend label, elapsed time, and optional session metadata.
- `ask(text, signal, plan)` is the compatibility shortcut that returns only final answer text.
- `capabilities` declares whether the backend supports session resume, streaming progress, and cancellation.
- Hermes is the reference adapter: resume, verbose progress streaming, cancellation, and final-answer recovery from Hermes session files.

New backends should implement the same contract and keep voice/STT/TTS behavior outside the adapter.

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
UTTERANCE_IDLE_MS="2000"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## TTS Voice Selection

Language presets and voice selection are separate:

- `vc language ko|en|auto` changes STT language, progress language, and the default voice for that language.
- Live voice commands such as “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female`, and `switch speaker to English` change only the speaker/voice type.
- `!voice-test <text>` plays a quick sample with the currently selected backend and voice.

Voice selection is stored in `config/tts-voices.json` by default. Override the path with `TTS_VOICE_CONFIG`. The running bridge re-reads/applies voice selection before synthesis, so voice commands take effect without a full restart.

Default Edge catalog:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | Language |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | Korean |
| `korean_female` | `ko-KR-SunHiNeural` | Korean |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | Korean |
| `english_male` | `en-US-GuyNeural` | English |
| `english_female` | `en-US-AriaNeural` | English |

Manual persistent override:

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

For OpenVoice, SpeechSwift, or Supertonic, keep the backend-specific voice/reference settings in the sections below; the same voice catalog file can still track the active voice type.

## MCP Server

VerbalCoding ships a stdio MCP server so Hermes Agent or any MCP client can control the bridge through tools instead of relying on skills or free-form shell commands.

Hermes config example:

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

Exposed MCP tools:

| Tool | Purpose |
|---|---|
| `status` | Report bridge/config status without secrets |
| `doctor` | Run the redacted doctor check |
| `set_auto_restart` | Enable/disable commit-time voice-bot auto-restart |
| `set_language` | Update STT/progress/TTS language together |
| `start`, `stop`, `restart` | Control the Discord voice bridge |

## Optional OpenVoice TTS

Edge TTS remains the default and fallback. To try local voice cloning with OpenVoice V2:

```bash
./scripts/setup_openvoice.sh
# Download checkpoints_v2_0417.zip from OpenVoice docs and extract under vendor/OpenVoice/checkpoints_v2/
mkdir -p voice-samples
# Put a permitted reference sample at voice-samples/user-reference.wav,
# or capture one from Discord with !voice-clone capture.
python3 scripts/openvoice_smoke.py
```

Then set:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

Only clone voices you own or have permission to use. If OpenVoice fails or times out, VerbalCoding falls back to Edge TTS.

## Optional Supertonic TTS

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

Then set:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

If Supertonic is missing, fails, or times out, VerbalCoding falls back to Edge TTS.

## Optional SpeechSwift / CosyVoice TTS

On Apple Silicon, `speech-swift` is a local backend for Korean voice cloning with MLX-native CosyVoice/Qwen3-TTS.

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

Recommended env:

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

Keep Edge for quick progress/backchannel prompts.

## Operational Notes

- Bot needs Discord privileged Message Content intent enabled for text commands.
- Bot needs voice channel connect/speak permissions.
- For Hermes Agent, configure/authenticate Hermes normally (`hermes setup`, `hermes login`, etc.) on your default profile.
- For Claude Code, Codex, Gemini, OpenCode, OpenClaw, install and authenticate those CLIs separately.
- If a CLI emits diff/code output on timeout or signal failure, the bridge avoids reading it aloud and sends detailed text instead.
