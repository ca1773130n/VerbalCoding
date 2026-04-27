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

## Expected runtime signals

Successful startup logs include:

```text
Logged in as Hermes#6718
Listening in voice channel <server> / <channel>
```

A `bash: ... tcsetattr: Inappropriate ioctl for device` line can appear when running under Hermes background process tracking. It is non-fatal if login and voice listening succeeded.
