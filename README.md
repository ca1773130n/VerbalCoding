# Hermes-Discord

Discord voice bridge for talking to the local Hermes Agent like a phone call.

## What it does

- `!join`: bot joins your current Discord voice channel.
- Listens to incoming voice with `discord-ext-voice-recv`.
- Converts Discord PCM (48 kHz stereo) to 16 kHz mono.
- Uses WebRTC VAD to detect utterance boundaries.
- Transcribes speech with local `whisper.cpp` by default (`faster-whisper` remains available as a fallback engine).
- Sends the transcript to the existing local Hermes CLI (`hermes chat -Q -q ...`) so it reuses your normal Hermes config/OAuth/tools.
- Synthesizes Hermes' answer with free Edge TTS and plays it back into the voice channel.
- `!say <prompt>` lets you test the Hermes/TTS path from a text channel.
- `!leave`: disconnects.

## Setup

```bash
cd ~/Developer/Projects/Hermes-Discord
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Make sure `ffmpeg` and `whisper.cpp` are installed:

```bash
brew install ffmpeg whisper-cpp
mkdir -p models
curl -L -o models/ggml-small-q5_1.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
```

The app reads tokens from `.env` and also parses simple `export NAME=value` lines in `~/.zshrc`.
Expected variables:

```bash
export DISCORD_BOT_TOKEN=...
export DISCORD_ALLOWED_USERS=123456789012345678   # optional comma-separated allowlist
```

Optional tuning:

```bash
export HERMES_COMMAND='hermes chat -Q -q'
export STT_ENGINE=whisper_cpp             # whisper_cpp or faster_whisper
export WHISPER_CPP_BIN=whisper-cli
export WHISPER_CPP_MODEL=./models/ggml-small-q5_1.bin
export WHISPER_MODEL=base                 # only used when STT_ENGINE=faster_whisper
export REQUIRE_WAKE_WORD=0
export WAKE_WORDS='hermes,헤르메스,허미스'
export TTS_VOICE=ko-KR-SunHiNeural
```

## Run

```bash
cd ~/Developer/Projects/Hermes-Discord
source .venv/bin/activate
python -m app.main
```

In Discord, join a voice channel and type `!join` in a text channel the bot can read.

## Notes

- The bot needs Discord privileged Message Content intent enabled for text commands.
- It also needs voice channel connect/speak permissions.
- First `whisper.cpp` run loads Metal backend and can take a few seconds; later runs are faster.
- `REQUIRE_WAKE_WORD=1` makes the bridge ignore utterances unless they include one of `WAKE_WORDS`.
