# Fresh install

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

> Clean install path for humans first, automation second.
>
> Fast path: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

This guide is for a clean public install. It avoids local-only assumptions and uses the `vc` CLI to bootstrap as much as possible. Windows is not supported yet.

## 1. Install the CLI and run guided setup

Recommended npm path for humans:

```bash
npm install -g verbalcoding@latest
vc setup
```

`vc setup` bootstraps supported local prerequisites, then asks for the Discord bot token, application/client ID, auto-join voice channel names, transcript target, agent backend, and voice/TTS settings. Keep the Discord Developer Portal open while it runs.

Automation/CI path:

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
```

Use `--yes` only when you need non-interactive bootstrap/starter config. It cannot stop and wait for you to create a Discord application, so token/channel setup remains a follow-up step in that mode.

Contributor GitHub clone path:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
```

For npm/global installs, use `vc ...` commands. Do not run `./scripts/install.sh` unless you are inside a repository clone.

## 2. What setup bootstraps

`vc setup` runs the bootstrap bundled in the npm package and writes `.env`. It can install or prepare:

- npm dependencies when `node_modules/` is missing,
- `ffmpeg`, Node/npm, Python venv support, build tools, and `whisper-cli` where supported,
- the default `models/ggml-small-q5_1.bin` whisper.cpp model,
- a local `.venv-tts` Edge TTS helper,
- the short `vc` shell command when running from a clone.

Supported system bootstrap paths:

| OS | System dependency path |
|---|---|
| macOS | Homebrew: `brew install node ffmpeg whisper-cpp` as needed |
| Debian/Ubuntu | `apt-get`; handles NodeSource npm conflicts and can locally build whisper.cpp |
| Fedora/RHEL | `dnf`; local whisper.cpp build fallback |
| Arch | `pacman`; local whisper.cpp build fallback |
| Windows | Not supported yet |

Useful installer variants:

```bash
vc setup --yes --no-wizard                   # dependency/bootstrap only from npm install
vc setup --yes --skip-system                 # skip OS package installation
vc setup --yes --skip-model                  # skip default STT model download
vc setup --yes --skip-edge-tts               # skip local Edge TTS helper
./scripts/install.sh --yes --no-wizard       # clone-only non-interactive equivalent
```

## 3. Discord values collected by setup

Read the upstream Discord bot setup guides if this is your first bot:

- Hermes Agent Discord messaging guide: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord official bot overview: <https://docs.discord.com/developers/bots/overview>
- Discord official getting started guide: <https://docs.discord.com/developers/quick-start/getting-started>

During `vc setup`:

1. Create a Discord application/bot in the Developer Portal.
2. Enable the Message Content privileged intent.
3. Paste the bot token when asked for `DISCORD_BOT_TOKEN`.
4. Paste the application/client ID when asked; setup can print the invite command.
5. Enter the real voice channel names the bot should auto-join.

Invite URL helper:

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

If you skipped a value or need to rotate it later, update only that part:

```bash
vc setup token
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
```

`vc setup token` updates `DISCORD_BOT_TOKEN` and optional `DISCORD_CLIENT_ID`; `vc setup channels` updates `AUTO_JOIN_VOICE_CHANNELS`. Both preserve unrelated `.env` values, set mode `0600`, and do not print secrets back.

## 4. Auto-join voice channel names

Use the exact Discord voice channel names:

```bash
vc setup channels
vc setup channels "General,Team Voice"
vc setup channel "General"
vc setup voice "General"
```

Restart the bridge after changing channel names.

## 5. Verify

```bash
vc doctor
```

`vc doctor` is redacted: it reports missing tokens/commands/models without printing secret values. On supported macOS/Linux installs it attempts to auto-fix installable prerequisites first, including `ffmpeg`, `whisper-cli`/model, Edge TTS helper, and Hermes CLI for the default Hermes backend. Use this opt-out if you only want diagnosis:

```bash
VERBALCODING_DOCTOR_INSTALL_HERMES=0 vc doctor
```

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

If `DISCORD_BOT_TOKEN` is missing, run `vc setup token`. If no configured channel is found, run `vc setup channels "<actual voice channel name>"`.

## 6. Run the single default bot

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

## 7. Docker and containers

Discord text/gateway login uses TCP/WebSocket, but Discord voice also needs UDP. If `vc start` logs this, the channel was found but voice UDP discovery failed:

```text
Cannot perform IP discovery - socket closed
```

On Linux Docker Compose, use host networking for the service running `vc start`:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Remove any `ports:` block from that service when using host networking. On Docker Desktop for macOS/Windows, host networking behaves differently; if UDP voice still fails, run VerbalCoding directly on the host or in a Linux VM. See [Troubleshooting](TROUBLESHOOTING.md).

## 8. Project-per-room setup

For one permanent bot per project voice room, create one Discord application per project, then:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

Each instance writes an ignored `instances/<name>.env` with its own token, voice channel, transcript target, log path, Hermes session file, and optional Hermes profile.

## 9. Optional OpenVoice setup

OpenVoice voice cloning is optional. Keep `TTS_BACKEND=edge` for a fresh public install. To enable OpenVoice later:

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Then set `TTS_BACKEND=openvoice`, run `vc doctor`, and test `!voice-test <text>` in Discord.

## 10. Clean clone smoke test for maintainers

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

Docker-based Ubuntu clean install smoke test:

```bash
./scripts/docker_ubuntu_smoke.sh
```

This validates bootstrap and doctor behavior in a clean container. It does not connect to Discord voice; use a real Linux host/VM for end-to-end voice UDP testing.
