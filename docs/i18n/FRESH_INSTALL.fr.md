# Installation propre

This guide mirrors the English fresh-install flow for Français. It is intended for a clean public install and avoids local-only assumptions.

## 1. Install the CLI

```bash
npm install -g verbalcoding
vc setup --yes
```

Or run the published package directly:

```bash
npx verbalcoding setup --yes
```

Contributor clone path:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. Bootstrap dependencies

The setup flow installs npm dependencies when needed, links the short `vc` command for clone installs, installs `ffmpeg` / Node / `whisper-cli` where the OS package manager supports it, downloads `models/ggml-small-q5_1.bin`, creates `.venv-tts`, and writes `.env`.

Useful variants:

```bash
vc setup --yes --no-wizard
./scripts/install.sh --yes --no-wizard
./scripts/install.sh --skip-system
./scripts/install.sh --skip-model
./scripts/install.sh --skip-edge-tts
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

Supported bootstrap paths: macOS/Homebrew, Debian/Ubuntu `apt`, Fedora/RHEL `dnf`, and Arch `pacman`. If unsupported, manually install Node.js 20+, npm, ffmpeg, Python 3, `whisper-cli`, and an authenticated CLI agent backend.

## 3. Discord application setup

Read the upstream bot guides first:

- Hermes Agent Discord guide: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord official bot overview: <https://docs.discord.com/developers/bots/overview>
- Discord official getting started guide: <https://docs.discord.com/developers/quick-start/getting-started>

Create a Discord application and bot, enable the Message Content privileged intent, put the token in the installer or `.env` as `DISCORD_BOT_TOKEN`, then generate the invite URL:

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## 4. Verify

```bash
vc doctor
```

`vc doctor` redacts secrets and reports missing commands/models/tokens without printing sensitive values. Expected success includes Node.js, npm, ffmpeg, whisper-cli, the model, Discord bot token configured, edge-tts, and the selected agent CLI.

## 5. Run

```bash
vc start
# or, from a GitHub clone:
./run.sh
```

Expected log lines:

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

## 7. Optional OpenVoice setup

Keep `TTS_BACKEND=edge` for a fresh install. To enable OpenVoice later:

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Then set `TTS_BACKEND=openvoice`, run `vc doctor`, and test `!voice-test <text>` in Discord.

## 8. Maintainer smoke tests

```bash
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
vc doctor || true
./scripts/docker_ubuntu_smoke.sh
```
