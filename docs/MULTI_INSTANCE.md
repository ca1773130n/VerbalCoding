# Multi-instance VerbalCoding

VerbalCoding can run multiple independent Discord voice bridge processes. Each process is still the existing single-instance Node bridge, but it loads a different `instances/<name>.env` file and uses a different Discord bot token.

Use this when each project should permanently occupy its own Discord voice channel and write to its own transcript channel/thread.

## Why multiple bot tokens are required

Discord voice residency is effectively one active voice connection per bot account per guild. If one bot token joins another voice channel in the same guild, it cannot also remain permanently connected to the previous channel. For simultaneous project rooms, create one Discord application/bot per project.

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

Real `instances/*.env` files are ignored because they may contain Discord tokens. `instances/example.env` is the committed template.

## Instance setup wizard

Users should not copy and manually edit env files for normal use. Run the wizard instead:

```bash
vc instance setup llm-wiki
# or through the project setup script:
./scripts/install.sh --instance llm-wiki
```

The wizard prompts for the bot token, Discord Application/Client ID, voice channel, transcript target, workdir, project context, and isolated runtime paths. It writes `instances/<name>.env` with mode `0600`, backs up an existing file before overwriting it, and prints the next start/status commands.

If you enter the Discord Application/Client ID during setup, the summary also prints the invite URL for that bot. You can generate the same URL any time with:

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

Discord still requires one Developer Portal application/bot per simultaneous voice room, but this avoids manually building OAuth URLs or permission integers.

## Minimal generated instance env

```env
INSTANCE_NAME=llm-wiki
DISCORD_TOKEN=replace-with-bot-token
DISCORD_CLIENT_ID=1497879755394125924
AUTO_JOIN_VOICE_CHANNELS=LLM-Wiki
TRANSCRIPT_CHANNEL_ID=1497890694730219540
PROJECT_SESSIONS_FILE=config/project-sessions.llm-wiki.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-llm-wiki.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-llm-wiki-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/llm-wiki.session
AGENT_LABEL=Hermes Agent · LLM-Wiki
AGENT_CWD=/Users/neo/Developer/Projects/LLM-Wiki
AGENT_PROJECT_CONTEXT=Project session: LLM-Wiki
```

Give every instance unique values for log/debug/session files. `vc doctor` checks for duplicate tokens and colliding runtime paths without printing secrets.

## Commands

```bash
vc instance list
vc instance status
vc instance status llm-wiki
vc instance start llm-wiki
vc instance stop llm-wiki
vc instance restart llm-wiki
```

`start` runs `./run.sh instances/<name>.env` detached and writes `.run/instances/<name>.pid`.

`stop` sends `SIGTERM`, waits up to 10 seconds, then falls back to `SIGKILL` and removes the pid file.

## Example: two permanent voice rooms

1. Create two Discord applications/bots:
   - VerbalCoding bot
   - LLM-Wiki bot

2. Invite both to the server with text and voice permissions:
   - View Channel
   - Send Messages
   - Send Messages in Threads
   - Read Message History
   - Use Application Commands
   - Connect
   - Speak

   Use `vc bot invite <client-id>` after creating each Discord application to print the exact invite URL with those permissions.

3. Run the setup wizard for each local instance:

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

The wizard writes ignored `instances/verbalcoding.env` and `instances/llm-wiki.env` files with mode `0600`; it also backs up an existing instance env before replacing it.

4. Check config:

```bash
vc doctor
```

5. Start both:

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. Verify logs:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

Expected log lines:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. Stop both:

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## Short-term single-bot text/voice binding

If you only have one bot token, use project-session voice binding instead of simultaneous multi-channel residency.

Run this in the target text channel/thread:

```text
!session attach-voice --voice "LLM-Wiki"
```

Behavior:

- Binds the selected voice channel to the current text channel/thread.
- If the current text channel has no project session, creates an ad-hoc isolated session.
- Voice STT/result/progress/final-answer text routes to that active project transcript target.

To attach an existing named project session:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

This is convenient for routing, but it does not make one bot stay in two voice channels at the same time. Use multiple bot tokens/processes for simultaneous permanent residency.
