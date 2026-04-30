# Fresh install test

Use this to verify VerbalCoding can be set up from a clean clone without relying on local build artifacts.

## Clean clone smoke test

```bash
TMPDIR=$(mktemp -d)
git clone git@github.com:ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
npm install
cp .env.example .env
chmod 600 .env
npm run doctor || true
```

`npm run doctor` should print missing secrets/model/CLI items as `✗` without exposing secret values. After filling `.env` and downloading the model, it should pass.

## Full setup

```bash
brew install ffmpeg whisper-cpp
mkdir -p models
curl -L -o models/ggml-small-q5_1.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
./scripts/install.sh
npm run doctor
./run.sh
```

## Optional OpenVoice setup

OpenVoice voice cloning is optional. Keep `TTS_BACKEND=edge` for a fresh install. To enable it later:

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Either add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 scripts/openvoice_smoke.py
```

Then set `TTS_BACKEND=openvoice`, run `npm run doctor`, and test `!voice-test <text>` in Discord.

## Expected runtime signals

Successful startup logs include:

```text
Logged in as Hermes#6718
Listening in voice channel <server> / <channel>
```

A `bash: ... tcsetattr: Inappropriate ioctl for device` line can appear when running under Hermes background process tracking. It is non-fatal if login and voice listening succeeded.
