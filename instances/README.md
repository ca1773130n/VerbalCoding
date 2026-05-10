# VerbalCoding instances

This directory holds local per-instance env files for running multiple VerbalCoding Discord voice bots at the same time.

Use the setup wizard to create or update `instances/<name>.env`; do not copy/edit env files manually for normal use. Real instance env files are ignored by git because they may contain Discord bot tokens.

Rules:

- Use a distinct Discord application/bot token for every running instance.
- Do not reuse the same token in two running instances; Discord voice is effectively one active voice connection per bot per guild.
- Invite each bot to the server with text and voice permissions. After creating the application in Discord, run `vc bot invite <client-id>` to print the correct invite URL.
- `AUTO_JOIN_VOICE_CHANNELS` should usually contain exactly one voice channel name per instance.
- `TRANSCRIPT_CHANNEL_ID` may be a text channel ID or a thread ID.
- Give each instance isolated values for:
  - `PROJECT_SESSIONS_FILE`
  - `BRIDGE_LOG_PATH`
  - `NODE_AUDIO_DEBUG_DIR`
  - `HERMES_SESSION_FILE`
  - `HERMES_HOME` (set automatically by `vc instance setup`)

Typical commands:

```bash
vc instance status
vc bot invite 123456789012345678
vc instance setup llm-wiki
vc instance start llm-wiki
vc instance stop llm-wiki
vc instance restart llm-wiki
vc doctor
```

For the single default bot, use the targeted setup commands instead of editing `.env` manually:

```bash
vc setup token
vc setup channels "General,Team Voice"
```
