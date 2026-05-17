# VerbalCoding Configuration

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../README.md">README</a> ·
  <a href="README.md">Docs hub</a> ·
  <a href="FRESH_INSTALL.md">Fresh Install</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.md">Multi-Instance</a>
</p>

> Settings reference for Discord, agents, TTS, MCP, and runtime behavior.
>
> Fast path: `vc setup handles normal config; edit .env only for advanced overrides`
<!-- /readme-glow-up:intro -->

## Setup Command Map

For npm/global installs, use `vc` commands instead of manually editing `.env`:

```bash
vc setup                               # guided setup: prerequisites, Discord token, voice channels
vc setup --yes                         # non-interactive bootstrap/starter config
vc setup token                         # later update Discord bot token
vc setup channels "General,Team Voice" # later update auto-join voice channel names
vc setup channel "General"             # alias
vc setup voice "General"               # alias
vc doctor                               # redacted health check and supported auto-fixes
vc start                                # run the default bridge
```

Clone-only setup remains available:

```bash
./scripts/install.sh --yes
```

`vc setup token` updates `DISCORD_BOT_TOKEN` and optional `DISCORD_CLIENT_ID`. `vc setup channels` updates `AUTO_JOIN_VOICE_CHANNELS`. Both preserve unrelated `.env` values, write the file with mode `0600`, and avoid printing token values.

## Discord Bot/Application Setup

Use these upstream guides for the Discord-side steps, then return to VerbalCoding setup:

- Hermes Agent Discord messaging guide: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord official bot overview: <https://docs.discord.com/developers/bots/overview>
- Discord official quick start: <https://docs.discord.com/developers/quick-start/getting-started>

Minimum flow:

```bash
vc bot invite <discord-client-id>
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,General"
vc doctor
```

The bot needs Message Content privileged intent plus text/voice permissions for the target channels.

## Supported Agent Backends

Set `AGENT_BACKEND` in `.env`.

| Backend | Default command | Notes |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | Default. Preserves `.verbalcoding-session` resume behavior. `vc doctor` can auto-install the Hermes CLI on supported macOS/Linux installs. |
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
UTTERANCE_IDLE_MS=4500
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
DISCORD_CLIENT_ID="123456789012345678"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="VerbalCoding,General"
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

Language presets and voice selection are separate:

- `vc language ko|en|auto` changes STT language, progress language, and the default voice for that language.
- Live voice commands such as “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female`, and `switch speaker to English` change only the speaker/voice type.
- `!voice-test <text>` plays a quick sample with the currently selected backend and voice.

Voice selection is stored in `config/tts-voices.json` by default. Override the path with `TTS_VOICE_CONFIG`.

| `TTS_VOICE_TYPE` | `TTS_VOICE` | Language |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | Korean |
| `korean_female` | `ko-KR-SunHiNeural` | Korean |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | Korean |
| `english_male` | `en-US-GuyNeural` | English |
| `english_female` | `en-US-AriaNeural` | English |

## Utterance Segmentation

`UTTERANCE_IDLE_MS` controls how long the bridge waits after a speech segment before it decides the user is done and starts STT.

```bash
UTTERANCE_IDLE_MS="4500"  # balanced default
UTTERANCE_IDLE_MS="6000"  # safer for long dictation with pauses
```

## MCP Server

VerbalCoding ships a stdio MCP server so Hermes Agent or any MCP client can control the bridge through tools.

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

## Docker / Container Networking

Discord voice needs outbound UDP. If Docker logs show `Cannot perform IP discovery - socket closed`, try Linux host networking:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Remove `ports:` from that Compose service. On Docker Desktop for macOS/Windows, host networking may not expose UDP the same way; run on the host or a Linux VM if voice still fails.

## Optional TTS Backends

Edge TTS remains the default and fallback. Optional local backends are configured with their own env vars:

| Backend | Settings | Voice choices |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | Built-in types above, plus any voice returned by `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`; language `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | User-provided permitted reference WAV; style defaults to `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | Reference-sample voices for CosyVoice, or backend-supported speaker/model IDs |
| OmniVoice | `OMNIVOICE_PYTHON`, `OMNIVOICE_MODEL`, `OMNIVOICE_REF_AUDIO`, `OMNIVOICE_REF_TEXT`, `OMNIVOICE_LANGUAGE`, `OMNIVOICE_SPEAKER` | k2-fsa/OmniVoice reference-sample cloning or optional voice-design attributes |
| NeuTTS Air | `NEUTTSAIR_PYTHON`, `NEUTTSAIR_BACKBONE_REPO`, `NEUTTSAIR_CODEC_REPO`, `NEUTTSAIR_REF_AUDIO`, `NEUTTSAIR_REF_TEXT` | English NeuTTS Air reference-sample cloning; use Q4 GGUF for lower latency |

Only clone voices you own or have permission to use. For OmniVoice, install it in a separate Python environment such as `.venv-omnivoice` (`pip install torch torchaudio soundfile omnivoice`) and set `TTS_BACKEND=omnivoice`. For NeuTTS Air, install the local `neutts` package in `.venv-neuttsair`, set `TTS_BACKEND=neuttsair`, and keep progress prompts on Edge unless explicitly testing local progress TTS. If a local backend fails or times out, VerbalCoding falls back to Edge TTS.

## Operational Notes

- Bot needs Discord privileged Message Content intent enabled for text commands.
- Bot needs voice channel connect/speak permissions.
- For Hermes Agent, configure/authenticate Hermes normally (`hermes setup`, `hermes login`, etc.) on your default profile.
- For Claude Code, Codex, Gemini, OpenCode, OpenClaw, install and authenticate those CLIs separately.
- If a CLI emits diff/code output on timeout or signal failure, the bridge avoids reading it aloud and sends detailed text instead.
