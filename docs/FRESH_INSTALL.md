# Fresh install

This guide is for a clean public install. It avoids local-only assumptions and uses the installer to bootstrap as much as possible.

## 1. Install the CLI

Recommended npm path:

```bash
npm install -g verbalcoding
```

Or run the published package directly:

```bash
npx verbalcoding setup --yes
```

If you used `npm install -g`, continue with:

```bash
vc setup --yes
```

Contributor GitHub clone path:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. Bootstrap dependencies and run the setup wizard

The npm commands above run the same bootstrapper as the clone install. For a clone, run:

```bash
./scripts/install.sh --yes
```

What this does:

- installs npm dependencies when `node_modules/` is missing,
- installs the short `vc` shell command with `npm link`,
- installs `ffmpeg`, Node/npm, and `whisper-cli` when supported by the OS package manager,
- downloads `models/ggml-small-q5_1.bin`,
- creates `.venv-tts` and installs `edge-tts` when `edge-tts` is not already on `PATH`,
- runs the interactive `.env` wizard.

Supported system bootstrap paths:

| OS | System dependency path |
|---|---|
| macOS | Homebrew: `brew install node ffmpeg whisper-cpp` as needed |
| Debian/Ubuntu | `apt-get` for Node/npm, ffmpeg, Python, build tools; local whisper.cpp build fallback |
| Fedora/RHEL | `dnf` for Node/npm, ffmpeg, Python, build tools; local whisper.cpp build fallback |
| Arch | `pacman` for Node/npm, ffmpeg, Python, build tools; local whisper.cpp build fallback |

Useful installer variants:

```bash
vc setup --yes --no-wizard                   # dependency/bootstrap only from npm install
./scripts/install.sh --yes --no-wizard       # dependency/bootstrap only from a clone
./scripts/install.sh --skip-system           # do not install OS packages
./scripts/install.sh --skip-model            # do not download the default STT model
./scripts/install.sh --skip-edge-tts         # do not create .venv-tts
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

If your OS is unsupported, install these manually before rerunning:

- Node.js 20+ and npm
- ffmpeg
- Python 3 with venv/pip
- whisper.cpp `whisper-cli`
- one authenticated CLI agent backend, Hermes Agent by default

## 3. Discord application setup

1. Create a Discord application and bot in the Discord Developer Portal.
2. Enable the Message Content privileged intent.
3. Copy the bot token into the installer prompt or `.env` as `DISCORD_BOT_TOKEN`.
4. Generate an invite URL:

```bash
vc bot invite <discord-client-id>
# or pin it to one server:
vc bot invite <discord-client-id> --guild <guild-id>
```

The invite includes bot and slash-command scopes plus text/voice permissions used by VerbalCoding.

## 4. Verify

```bash
vc doctor
```

`vc doctor` is redacted: it reports missing tokens/commands/models without printing secret values. Fix every `✗` item, then rerun it.

Expected success includes:

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

If the installer created a local Edge TTS helper, `.env` should contain an `EDGE_TTS_COMMAND` path pointing at `.venv-tts/bin/edge-tts`.

## 5. Run the single default bot

```bash
vc start
# or, from a GitHub clone:
./run.sh
```

Successful startup logs include:

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

In Discord:

```text
!ping
!join
!ask say hello briefly
!verbose on
```

Then speak in the configured voice channel. You should see STT text, progress text when verbose mode is on, a final text answer, and hear TTS playback.

## 6. Project-per-room setup

For one permanent bot per project voice room, create one Discord application per project, then:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

Each instance writes an ignored `instances/<name>.env` with its own token, voice channel, transcript target, log path, Hermes session file, and optional Hermes profile.

## 7. Optional OpenVoice setup

OpenVoice voice cloning is optional. Keep `TTS_BACKEND=edge` for a fresh public install. To enable OpenVoice later:

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 scripts/openvoice_smoke.py
```

Then set `TTS_BACKEND=openvoice`, run `vc doctor`, and test `!voice-test <text>` in Discord.

## 8. Clean clone smoke test for maintainers

Fast host-only smoke test:

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

The expected failure at this point is missing local secrets or unauthenticated agent CLI, not leaked tokens or missing install scripts.

Docker-based Ubuntu clean install smoke test:

```bash
./scripts/docker_ubuntu_smoke.sh
```

This runs `ubuntu:24.04`, copies the tracked repository tree into a clean container, runs `./scripts/install.sh --yes --no-wizard`, writes a non-secret smoke `.env`, checks `vc`, runs Node tests, and verifies `vc doctor`. It does not connect to Discord voice; use a real Ubuntu VM or WSL2 after this if you need an end-to-end voice-channel test.
