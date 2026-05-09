# VerbalCoding マルチインスタンス

VerbalCoding can run multiple independent Discord voice bridge processes. Each process loads a different `instances/<name>.env` file and uses a different Discord bot token.

Use this when each project should permanently occupy its own Discord voice channel and write to its own transcript channel/thread.

## Why multiple bot tokens are required

Discord voice residency is effectively one active voice connection per bot account per guild. For simultaneous project rooms, create one Discord application/bot per project.

## File layout

```text
instances/
  README.md
  example.env
  llm-wiki.env        # local only, ignored by git
  verbalcoding.env    # local only, ignored by git
.run/instances/
  llm-wiki.pid        # runtime only, ignored by git
```

Real `instances/*.env` files are ignored because they may contain Discord tokens.

## Instance setup wizard

```bash
vc instance setup llm-wiki
./scripts/install.sh --instance llm-wiki
```

The wizard asks for bot token, Discord Application/Client ID, voice channel, transcript target, workdir, project context, and isolated runtime paths. It writes `instances/<name>.env` with mode `0600` and backs up an existing file.

Generate invite URLs with:

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

## Hermes profile isolation

Each instance gets its own Hermes home at `~/.hermes/profiles/<name>` so memory, `MEMORY.md`, `SOUL.md`, and learned skills do not leak across projects.

`vc instance setup <name>` creates or reuses the profile, sets `terminal.cwd`, seeds `SOUL.md`, and writes `HERMES_HOME` into the instance env. Instance names must match `^[a-z0-9][a-z0-9_-]{0,63}$`.

## Minimal generated instance env

```env
INSTANCE_NAME=my-project
DISCORD_TOKEN=replac...oken
DISCORD_CLIENT_ID=123456789012345678
AUTO_JOIN_VOICE_CHANNELS=Project Room
TRANSCRIPT_CHANNEL_ID=123456789012345678
PROJECT_SESSIONS_FILE=config/project-sessions.my-project.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-my-project.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-my-project-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/my-project.session
HERMES_HOME=/home/you/.hermes/profiles/my-project
AGENT_LABEL=VerbalCoding · My Project
AGENT_CWD=/path/to/my-project
AGENT_PROJECT_CONTEXT=Project session: My Project
```

`vc doctor` checks duplicate tokens, colliding runtime paths, missing profile directories, and `terminal.cwd` mismatches without printing secrets.

## Commands

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

## Example: two permanent voice rooms

1. Create two Discord applications/bots.
2. Invite both with text and voice permissions. Use `vc bot invite <client-id>`.
3. Run setup:

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

4. Check and start:

```bash
vc doctor
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

5. Verify logs:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

Expected:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

## Short-term single-bot text/voice binding

If you only have one bot token, bind a project session to a voice channel instead of simultaneous residency:

```text
!session attach-voice --voice "LLM-Wiki"
!session voice llm-wiki --voice "LLM-Wiki"
```

This routes text/STT/result/progress/final answer messages correctly, but it does not make one bot stay in two voice channels at the same time.
