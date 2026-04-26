# VerbalCoding

Discord voice bridge for talking to **any CLI-based agent harness** like a phone call.

The Discord/STT/TTS layer is independent from the agent runner. The backend is selected by an adapter, so the same voice bridge can call Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or any custom command-line harness.

## What it does

- Auto-joins the configured Discord voice channel, or joins with `!join`.
- Receives Discord voice with Node `@discordjs/voice` receiver.
- Converts Discord 48 kHz stereo audio to 16 kHz mono.
- Transcribes Korean speech with local `whisper.cpp` + Metal.
- Sends the transcript to the configured CLI harness adapter.
- Speaks the answer back with Edge TTS.
- Shares the selected harness session between voice and `!ask` text input where the harness supports sessions.
- Avoids reading long diffs/code blocks aloud; detailed output goes to the text channel.

## Supported harness adapters

Set `AGENT_BACKEND` in `.env`:

| Backend | Default command | Notes |
| --- | --- | --- |
| `hermes` | `hermes chat -Q -q` | Default. Preserves existing `.verbalcoding-session` resume behavior. |
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
AGENT_TASK_TIMEOUT_MS=0        # 0 disables Node-side timeout for long agent tasks
AGENT_CHAT_TIMEOUT_MS=45000
```

## Install / setup wizard

```bash
cd ~/Developer/Projects/VerbalCoding
./scripts/install.sh
```

The installer asks for:

- Discord bot token
- allowed Discord user IDs
- default voice channel names
- transcript text channel/thread ID
- harness backend (`hermes`, `claude-code`, `codex`, `gemini`, `opencode`, `openclaw`, `custom`)
- custom harness command if needed
- TTS voice/rate and wake-word behavior

It writes a local `.env` file with mode `0600`. `.env` is ignored by git.

You can also run:

```bash
npm run setup
```

## Manual setup

Install system dependencies:

```bash
brew install ffmpeg whisper-cpp
mkdir -p models
curl -L -o models/ggml-small-q5_1.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
npm install
```

Example `.env`:

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="1497890694730219540"

AGENT_BACKEND="hermes"
# AGENT_BACKEND="opencode"
# AGENT_BACKEND="custom"
# AGENT_LABEL="My Harness"
# AGENT_COMMAND="my-harness run"

TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
HERMES_TASK_TIMEOUT_MS="0"        # 0 disables Node-side timeout for long tasks
HERMES_CHAT_TIMEOUT_MS="45000"
```

## Run

```bash
cd ~/Developer/Projects/VerbalCoding
./run.sh
```

The bot auto-joins the first configured channel name, defaulting to `일반,General,general`.

## Discord commands

- `!ping` — basic bot check.
- `!join` — join the sender's current voice channel.
- `!leave` — disconnect.
- `!say <text>` — speak text directly through TTS.
- `!ask <prompt>` — send text through the same selected harness adapter as voice.
- `!session` — show the current adapter session ID when supported.
- `!reset-session` — clear the adapter session file when supported.
- `!sensitivity` — show current barge-in sensitivity thresholds.
- `!sensitivity conservative` — temporarily use stricter outdoor/noisy-environment barge-in detection.
- `!sensitivity normal` — restore normal indoor sensitivity.

## Notes

- Bot needs Discord privileged Message Content intent enabled for text commands.
- Bot needs voice channel connect/speak permissions.
- For Hermes Agent, configure/authenticate Hermes normally (`hermes setup`, `hermes login`, etc.).
- For Claude Code, Codex, Gemini, OpenCode, OpenClaw, install and authenticate those CLIs separately.
- If a CLI emits diff/code output on timeout or signal failure, the bridge avoids reading it aloud and sends detailed text instead.
