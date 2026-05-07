# VerbalCoding

Talk to a CLI coding agent through Discord voice, like a phone call.

VerbalCoding keeps the Discord voice/STT/TTS layer separate from the agent runner. The same bridge can call Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or any custom command-line harness.

## Features

- Auto-joins a configured Discord voice channel, or joins with `!join`.
- Receives Discord voice through Node `@discordjs/voice`.
- Converts Discord 48 kHz stereo audio to 16 kHz mono STT input.
- Transcribes speech locally with `whisper.cpp` + Metal on macOS; language can be `ko`, `en`, or `auto`.
- Sends transcripts to a selected CLI harness adapter.
- Speaks answers back with Edge TTS; language presets switch STT, progress voice language, and TTS voice together.
- Shares the selected harness session between voice and `!ask` text input when supported.
- Splits long answers into sentence-sized TTS chunks for responsive barge-in.
- Avoids reading long diffs, code blocks, and stack traces aloud.
- Supports normal indoor sensitivity and temporary conservative/outdoor sensitivity.

## Architecture

```text
Discord voice channel
  -> @discordjs/voice receiver
  -> 48 kHz stereo PCM capture
  -> 16 kHz mono conversion + duration/volume gates
  -> whisper.cpp STT
  -> transcript cleanup / hallucination filters
  -> CLI harness adapter
  -> text answer + spoken summary
  -> Edge TTS chunk synthesis
  -> Discord voice playback
```

## Supported harness adapters

Set `AGENT_BACKEND` in `.env`:

| Backend | Default command | Notes |
| --- | --- | --- |
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
AGENT_TASK_TIMEOUT_MS=0        # 0 disables Node-side timeout for long agent tasks
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0      # default off; toggle with !verbose on/off
UTTERANCE_IDLE_MS=2000        # wait after last voice segment before STT
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## Agent adapter contract

The voice bridge talks to every backend through one adapter contract:

- `run({ text }, signal, plan)` returns a structured result: status, final answer text, backend label, elapsed time, and optional session metadata.
- `ask(text, signal, plan)` is the compatibility shortcut that returns only final answer text.
- `capabilities` declares whether the backend supports session resume, streaming progress, and cancellation.
- Hermes is the reference adapter: it supports resume, verbose progress streaming, cancellation, and final-answer recovery from Hermes session files when verbose CLI output omits the final answer.

New backends should implement the same contract and keep voice/STT/TTS behavior outside the adapter.

## Quick start

```bash
git clone git@github.com:ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
vc doctor
./run.sh
```

The installer asks for Discord token, allowed users, auto-join voice channel names, transcript channel/thread, CLI harness backend, default voice language, TTS settings, and wake-word behavior. It writes `.env` with mode `0600`; `.env` is ignored by git. It also links the short shell command `vc`, so users can manage instances with `vc instance setup` instead of long npm wrapper commands.

If you installed dependencies manually and only need the shell command, link it from the project root:

```bash
npm link
```

## CLI commands

VerbalCoding includes a small project CLI for common operator actions:

```bash
vc status              # show STT language, progress language, and TTS voice
vc language en         # English STT + English progress/TTS voice
vc language ko         # Korean STT + Korean progress/TTS voice
vc language auto       # Whisper auto-detect STT + English progress/TTS voice
vc restart auto status # show commit-time voice-bot auto-restart setting
vc restart auto on     # enable commit-time voice-bot auto-restart
vc restart auto off    # disable it; this is the default
vc bot invite CLIENT_ID # print a Discord invite URL with required bot permissions
vc instance status      # list per-instance bridge configs and process status
vc instance setup NAME  # interactive wizard; writes instances/NAME.env and creates ~/.hermes/profiles/NAME
vc instance start NAME  # start ./run.sh instances/NAME.env as a detached process (self-heals missing Hermes profile)
vc instance stop NAME   # stop a detached instance and remove its pid file
vc doctor              # run the redacted doctor check
npm run mcp                       # run the stdio MCP server for Hermes/other MCP clients
```

Language changes update `.env`; restart the bridge with `./run.sh` or the running process manager for them to take effect.

## Discord bot invite helper

Discord does not let you clone one bot token into multiple independent bot accounts. For simultaneous always-on voice rooms, create one Discord application/bot per room in the Developer Portal, copy its Application/Client ID, then let VerbalCoding generate the invite URL:

```bash
vc bot invite 123456789012345678
# or pin the invite to one server:
vc bot invite 123456789012345678 --guild 987654321098765432
```

The generated URL requests the `bot` and `applications.commands` scopes plus the text/voice permissions VerbalCoding needs. `vc instance setup NAME` also asks for the Application/Client ID and prints the same invite URL in its summary.

## MCP server

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

- `status` — report bridge/config status without secrets.
- `doctor` — run the redacted doctor check.
- `set_auto_restart` — enable/disable commit-time voice-bot auto-restart; default is off.
- `set_language` — update STT/progress/TTS language together.
- `start`, `stop`, `restart` — control the long-running Discord voice bridge.

## Fresh install checklist

1. Install system dependencies:

   ```bash
   brew install ffmpeg whisper-cpp
   ```

2. Install Node dependencies and the `vc` shell command:

   ```bash
   npm install
   npm link
   ```

3. Download the default local STT model:

   ```bash
   mkdir -p models
   curl -L -o models/ggml-small-q5_1.bin \
     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
   ```

4. Create local config with the setup wizard:

   ```bash
   ./scripts/install.sh
   ```

5. Verify prerequisites without printing secrets:

   ```bash
   vc doctor
   ```

6. Start the bridge:

   ```bash
   ./run.sh
   ```

## Example `.env`

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
# AGENT_BACKEND="opencode"
# AGENT_BACKEND="custom"
# AGENT_LABEL="My Harness"
# AGENT_COMMAND="my-harness run"

STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"   # edge | openvoice | speechswift | supertonic
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"
SUPERTONIC_COMMAND="supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
OPENVOICE_DIR="./vendor/OpenVoice"
OPENVOICE_VENV="./.venv-openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_LANGUAGE="KR"
OPENVOICE_STYLE="default"
OPENVOICE_TIMEOUT_MS="90000"
OPENVOICE_PROGRESS="0"
REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="2000"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## Run

Single-instance bridge:

```bash
cd ~/Developer/Projects/VerbalCoding
./run.sh
```

Per-instance bridge using a local override env:

```bash
./run.sh instances/llm-wiki.env
# or
VERBALCODING_INSTANCE_ENV=instances/llm-wiki.env ./run.sh
```

The bot auto-joins the first configured channel name, defaulting to `일반,General,general`.

Runtime logs default to the path selected by your shell command. During local testing we commonly use:

```bash
/tmp/verbalcoding-node.log
/tmp/verbalcoding-node-debug
```

## Discord commands

- `!ping` — basic bot check.
- `!join` — join the sender's current voice channel.
- `!leave` — disconnect.
- `!say <text>` — speak text directly through TTS.
- `!voice-test <text>` — speak text with the active TTS backend, useful for comparing Edge and OpenVoice.
- `!voice-clone capture` — save the next valid Discord voice utterance as the OpenVoice reference sample.
- `!voice-clone status` / `!voice-clone cancel` — inspect or cancel a pending reference-sample capture.
- `!ask <prompt>` — send text through the same selected harness adapter as voice.
- `!session` / `!session status` — show the current project or default adapter session ID when supported.
- `!session new <name> <workdir> [context] --voice <voice-channel>` — create a project-scoped Hermes session for the current Discord text channel and the named voice channel. Example: `!session new my-project /path/to/my-project "project context" --voice "Project Room"`.
- `!session attach-voice [sessionName] --voice <voice-channel>` — bind the current text channel/thread to the selected voice channel. If no session name is given and the text channel has no session, the bridge creates an ad-hoc isolated channel session.
- `!session voice [sessionName] --voice <voice-channel>` — alias for `!session attach-voice`; useful for attaching an existing named project session to a voice channel.
- `!session use <name> --voice <voice-channel>` — bind the current Discord text channel, and optionally the named voice channel, to an existing project session.
- `!session list` — list configured project sessions.
- `!session reset` / `!reset-session` — clear the current project session file, or the default adapter session file if no project session is bound.
- `!verbose` — show whether detailed progress updates are enabled.
- `!verbose on` / `!verbose off` — toggle detailed progress updates in text and short spoken prompts. Default is off.
- `!latency` / `!metrics` — show recent average/p95 latency by pipeline stage.
- `!sensitivity` — show current barge-in sensitivity thresholds.
- `!sensitivity conservative` — temporarily use stricter outdoor/noisy-environment barge-in detection.
- `!sensitivity normal` — restore normal indoor sensitivity.

Voice equivalents such as “외부 모드”, “보수 모드”, “실내”, “기본 감도”, and clear stop phrases like “잠깐”, “멈춰”, “그만” are handled by the bridge. You can also say “상세 진행 켜” / “상세 진행 꺼” to toggle verbose progress by voice.

## Verbose progress mode

Verbose progress is **off by default** unless `AGENT_VERBOSE_PROGRESS=1` is set. When enabled with `!verbose on`, `AGENT_VERBOSE_PROGRESS=1`, or a voice command like “상세 진행 켜”, VerbalCoding sends progress notes and speaks the action names, such as:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

This mode asks the selected CLI harness to emit `VERBALCODING_PROGRESS: ...` lines and also summarizes common tool markers from streaming stdout/stderr when available. Secret-looking fields are redacted and progress lines are removed from the final spoken answer.

## Optional OpenVoice voice cloning TTS

Edge TTS remains the default and fallback. To try local voice cloning with OpenVoice V2:

```bash
./scripts/setup_openvoice.sh
# Download checkpoints_v2_0417.zip from OpenVoice docs and extract under vendor/OpenVoice/checkpoints_v2/
mkdir -p voice-samples
# Option A: put a reference sample you own or have permission to clone at:
#   voice-samples/user-reference.wav
# Option B: while the bot is listening in Discord, say "목소리 샘플 녹음 시작해"
#   then speak 10-30 seconds; or type `!voice-clone capture` and speak the sample.
python3 scripts/openvoice_smoke.py
```

Then set:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"  # keep short progress prompts on fast Edge fallback
```

Restart the bridge and test in Discord:

```text
!voice-test 안녕하세요. 버벌코딩 목소리 복제 테스트입니다.
```

Only clone voices you own or have permission to use. If OpenVoice fails or times out, VerbalCoding falls back to Edge TTS.

## Optional Supertonic TTS

Supertonic is a local/on-device TTS backend from Supertone. It supports Korean (`--lang ko`) and is designed for very low latency after the first model download. It does not require an API key.

```bash
./scripts/setup_supertonic.sh
# or: python3 -m pip install supertonic
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

Then set:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"  # or "supertonic" if globally installed
SUPERTONIC_VOICE="M1"      # M1-M5, F1-F5
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"       # fastest practical setting; raise for quality
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"    # keep short progress prompts on Edge
```

Restart the bridge and compare it with:

```text
!voice-test 안녕하세요. 수퍼토닉 백엔드 테스트입니다.
```

If Supertonic is missing, fails, or times out, VerbalCoding falls back to Edge TTS.

## Optional SpeechSwift / CosyVoice TTS

On Apple Silicon, `speech-swift` is the most promising local backend for Korean voice cloning with MLX-native CosyVoice/Qwen3-TTS. Install the CLI:

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

Then use the Discord-captured reference sample. `server` mode is preferred because `run.sh` starts/reuses a local `audio-server` and avoids spawning the `audio` CLI on every TTS request:

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"             # server recommended; cli is available for smoke tests
SPEECHSWIFT_ENGINE="cosyvoice"        # cosyvoice recommended; qwen3 is also supported
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"              # keep short progress prompts on Edge
```

Local server smoke test:

```bash
audio-server --host 127.0.0.1 --port 18080
curl -fsS http://127.0.0.1:18080/health
curl -fsS -X POST http://127.0.0.1:18080/speak \
  -H 'content-type: application/json' \
  -d '{"text":"안녕하세요. 오디오 서버 테스트입니다.","engine":"cosyvoice","language":"korean"}' \
  -o /tmp/verbalcoding-speechswift-server.wav
```

Local CLI smoke test:

```bash
audio speak --engine cosyvoice --language korean \
  --voice-sample voice-samples/user-reference.wav --stream \
  -o /tmp/verbalcoding-speechswift.wav \
  "안녕하세요. 스피치 스위프트 코지보이스 테스트입니다."
```

In current Mac mini testing, CosyVoice worked but was slower than Edge. CLI mode took about 6.9s wall time for 1.68s of audio. Server mode avoided repeated CLI process startup but still returns a completed WAV from `/speak`; warm requests were about 6.1s for roughly 3.0s of Korean audio. The current speech-swift `audio-server` `/speak` route does not expose the CLI `--voice-sample` cloning parameter, so it is useful as a warm local CosyVoice backend but not yet a true cloned-voice server path. Keep Edge for quick progress/backchannel prompts.

## Latency metrics

VerbalCoding always writes per-turn latency records as JSONL. Default path:

```text
./.logs/latency.jsonl
```

Each record includes status, total time, voice capture time, utterance idle wait, STT time, agent time, TTS synthesis/playback time, chunk counts, transcript length, answer length, and audio levels where available. Use this to identify whether optimization should focus on segmentation, STT, agent execution, or TTS. The default utterance idle wait is now `UTTERANCE_IDLE_MS=2000`, down from the earlier 2600 ms, so STT starts about 0.6 seconds sooner after the last voice segment while still leaving a pause window for Korean sentence endings.

In Discord:

```text
!latency
!metrics
```

prints a compact recent summary using the latest 200 records: count, avg, p95, max, and non-OK statuses.

## Testing

```bash
node --check app-node/main.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` intentionally redacts secrets and only reports whether required values are configured. It also checks `instances/*.env` for duplicate token fingerprints and colliding runtime paths.

For simultaneous project voice rooms, see [`docs/MULTI_INSTANCE.md`](docs/MULTI_INSTANCE.md).

## Multi-instance & Hermes profile isolation

Each vc instance is bound 1:1 to an isolated Hermes profile under `~/.hermes/profiles/<name>`. `vc instance setup <name>` clones your default Hermes home (carrying API keys and model selection), sets the new profile's `terminal.cwd` to the instance workdir, seeds `<profile>/SOUL.md` from the wizard's project-context answer, and writes `HERMES_HOME=...` into `instances/<name>.env`. Memory, MEMORY.md, learned skills, and SOUL.md therefore stay separate per project; sessions and memory start fresh while shared credentials carry over.

`vc instance start <name>` self-heals: if `HERMES_HOME` points at a profile dir that no longer exists, it is recreated before launch. `vc doctor` warns when an instance's `HERMES_HOME` points at a missing dir and errors when the profile's `terminal.cwd` does not match `AGENT_CWD`. Instance names must match `^[a-z0-9][a-z0-9_-]{0,63}$`, since Hermes uses the name as a directory and config key.

## Operational notes

- Bot needs Discord privileged Message Content intent enabled for text commands.
- Bot needs voice channel connect/speak permissions.
- For Hermes Agent, configure/authenticate Hermes normally (`hermes setup`, `hermes login`, etc.) on your default profile; per-instance profiles are cloned from it, so each instance inherits the auth without re-running setup.
- For Claude Code, Codex, Gemini, OpenCode, OpenClaw, install and authenticate those CLIs separately.
- If a CLI emits diff/code output on timeout or signal failure, the bridge avoids reading it aloud and sends detailed text instead.
- If the bot is restarted during debugging, old background sessions may emit delayed `exit code 143` or watch-pattern notifications; verify the current running process before treating those as failures.

## Release notes

See [`docs/RELEASE.md`](docs/RELEASE.md) for the current release checklist and feature summary.
