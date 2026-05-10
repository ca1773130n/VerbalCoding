# VerbalCoding instances

This directory is for local per-instance env files when one project should have its own always-on Discord voice bot.

## Use the wizard

Do not copy or edit env files manually for normal use. Run:

```bash
vc instance setup my-project
vc bot invite <client-id>
vc instance start my-project
vc instance status my-project
```

The wizard writes `instances/<name>.env` with mode `0600`, backs up an existing file before replacing it, and creates an isolated Hermes profile when configured. Real `instances/*.env` files are ignored by git because they may contain Discord bot tokens.

## Safety rules

| Rule | Why it matters |
|---|---|
| Use one Discord application/bot token per running instance. | One bot account can effectively keep only one active voice connection per guild. |
| Do not reuse the same token in two running instances. | Token reuse causes voice residency conflicts and doctor warnings. |
| Invite each bot with text and voice permissions. | `vc bot invite <client-id>` prints the correct OAuth URL. |
| Keep `AUTO_JOIN_VOICE_CHANNELS` focused. | Most instances should target exactly one project voice room. |
| Set a transcript target. | `TRANSCRIPT_CHANNEL_ID` may be a text channel ID or thread ID. |
| Keep runtime paths isolated. | Logs, debug audio, Hermes sessions, and Hermes profiles should not collide. |

## Runtime values that should differ per instance

```text
PROJECT_SESSIONS_FILE
BRIDGE_LOG_PATH
NODE_AUDIO_DEBUG_DIR
HERMES_SESSION_FILE
HERMES_HOME
```

`HERMES_HOME` is set automatically by `vc instance setup` when Hermes profile isolation is enabled.

## Command map

```bash
vc instance list
vc instance status
vc bot invite 123456789012345678
vc instance setup llm-wiki
vc instance start llm-wiki
vc instance stop llm-wiki
vc instance restart llm-wiki
vc doctor
```

For the single default bot, use targeted setup commands instead of editing `.env` manually:

```bash
vc setup token
vc setup channels "General,Team Voice"
```

See ../docs/MULTI_INSTANCE.md for the full multi-room workflow.
