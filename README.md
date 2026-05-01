# VerbalCoding

Talk to a CLI coding agent through Discord voice, like a phone call.

VerbalCoding keeps the Discord voice/STT/TTS layer separate from the agent runner. The same bridge can call Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or any custom command-line harness.

## Features

- Auto-joins a configured Discord voice channel, or joins with `!join`.
- Receives Discord voice through Node `@discordjs/voice`.
- Converts Discord 48 kHz stereo audio to 16 kHz mono STT input.
- Transcribes Korean speech locally with `whisper.cpp` + Metal on macOS.
- Sends transcripts to a selected CLI harness adapter.
- Speaks answers back with Edge TTS (`ko-KR-SunHiNeural` by default).
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

## Quick start

```bash
git clone git@github.com:ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
npm run doctor
./run.sh
```

The installer asks for Discord token, allowed users, auto-join voice channel names, transcript channel/thread, CLI harness backend, TTS settings, and wake-word behavior. It writes `.env` with mode `0600`; `.env` is ignored by git.

You can also run the installer directly:

```bash
npm run setup
```

## Fresh install checklist

1. Install system dependencies:

   ```bash
   brew install ffmpeg whisper-cpp
   ```

2. Install Node dependencies:

   ```bash
   npm install
   ```

3. Download the default local STT model:

   ```bash
   mkdir -p models
   curl -L -o models/ggml-small-q5_1.bin \
     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
   ```

4. Create local config:

   ```bash
   cp .env.example .env
   chmod 600 .env
   # Edit .env, or run ./scripts/install.sh
   ```

5. Verify prerequisites without printing secrets:

   ```bash
   npm run doctor
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
TRANSCRIPT_CHANNEL_ID="1497890694730219540"

AGENT_BACKEND="hermes"
# AGENT_BACKEND="opencode"
# AGENT_BACKEND="custom"
# AGENT_LABEL="My Harness"
# AGENT_COMMAND="my-harness run"

STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"   # edge | openvoice
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
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

```bash
cd ~/Developer/Projects/VerbalCoding
./run.sh
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
- `!session` — show the current adapter session ID when supported.
- `!reset-session` — clear the adapter session file when supported.
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
🔎 진행: Hermes Agent 호출 시작
🔎 진행: 파일 읽기 app-node/main.mjs
🔎 진행: 웹 검색 실행
🔎 진행: 터미널 명령 실행
🔎 진행: Hermes Agent 응답 수신
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
npm run doctor
```

`npm run doctor` intentionally redacts secrets and only reports whether required values are configured.

## Operational notes

- Bot needs Discord privileged Message Content intent enabled for text commands.
- Bot needs voice channel connect/speak permissions.
- For Hermes Agent, configure/authenticate Hermes normally (`hermes setup`, `hermes login`, etc.).
- For Claude Code, Codex, Gemini, OpenCode, OpenClaw, install and authenticate those CLIs separately.
- If a CLI emits diff/code output on timeout or signal failure, the bridge avoids reading it aloud and sends detailed text instead.
- If the bot is restarted during debugging, old background sessions may emit delayed `exit code 143` or watch-pattern notifications; verify the current running process before treating those as failures.

## Release notes

See [`docs/RELEASE.md`](docs/RELEASE.md) for the current release checklist and feature summary.
