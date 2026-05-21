# Deployment templates

Templates and helpers for running VerbalCoding as a long-lived service.

> See [`docs/USAGE.md`](../docs/USAGE.md) for the manual `./run.sh` flow when you don't want a service supervisor yet.

## macOS — launchd (recommended for a Mac mini host)

`launchd/com.verbalcoding.bot.plist` is a template. It expects you to:

1. Copy and edit:

   ```bash
   mkdir -p .logs                                                                   # launchd opens StandardOut/ErrorPath BEFORE run.sh starts, so create the dir first
   cp deploy/launchd/com.verbalcoding.bot.plist ~/Library/LaunchAgents/com.verbalcoding.bot.plist
   sed -i '' "s|/Users/YOU|$HOME|g" ~/Library/LaunchAgents/com.verbalcoding.bot.plist
   ```

   Then open the file and replace `Developer/Projects/VerbalCoding` with your actual checkout path if it differs, and the `v24.14.0` node version with `node --version` output (drop the leading `v` only if your nvm path uses that style). The plist's `ProgramArguments` also runs `mkdir -p .logs` defensively each restart so this doesn't bite again after a `git clean -fdx`.

2. Load it:

   ```bash
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.verbalcoding.bot.plist
   ```

3. Verify:

   ```bash
   launchctl print gui/$(id -u)/com.verbalcoding.bot | head
   tail -f .logs/launchd.out .logs/launchd.err
   ```

### Daily ops

| Action | Command |
|---|---|
| Restart after `git pull` | `launchctl kickstart -k gui/$(id -u)/com.verbalcoding.bot` |
| Stop without uninstall | `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.verbalcoding.bot.plist` |
| Start again | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.verbalcoding.bot.plist` |
| Uninstall | `bootout` as above, then `rm ~/Library/LaunchAgents/com.verbalcoding.bot.plist` |
| Live status | `launchctl list \| grep verbalcoding` |
| Live tail | `tail -F .logs/launchd.{out,err}` |

`KeepAlive` only restarts on crash; clean `process.exit(0)` from `gracefulShutdown` stays down so signal-driven restarts work as expected.

`ThrottleInterval=15` prevents crash-loops; bumps to ~60 if you hit storm states.

### Caveats

- The plist hardcodes the Node version path. If you change nvm default, edit the `PATH` line and `launchctl kickstart -k`.
- The plist file itself is per-host — it lives in `~/Library/LaunchAgents/` and is NOT tracked in this repo. Re-applying after a fresh checkout means re-copying from this template.
- If you have multiple instances on one host (per-project rooms), give each one a distinct `Label` and `instances/<name>.env` symlink path inside `ProgramArguments`.

## Linux — systemd (sketch)

Not yet templated. Pattern would be:

```ini
[Unit]
Description=VerbalCoding voice bridge
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/verbalcoding
ExecStart=/opt/verbalcoding/run.sh
Restart=on-failure
RestartSec=15
User=verbalcoding
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
```

A future PR can land this as `deploy/systemd/verbalcoding.service` when there's a Linux host to validate against.

## Docker / Compose

`docker-compose.yml` at the repo root drives the existing Hermes-aware containerized run. See [`docs/CONFIGURATION.md`](../docs/CONFIGURATION.md) for the Docker UDP path and env wiring.
