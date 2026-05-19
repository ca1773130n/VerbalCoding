# Hermes Agent — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

Hermes Agent is VerbalCoding's default backend — it is the one harness with a real session-resume contract, so chat across turns retains context cleanly. For positioning vs Hermes' built-in `/voice` slash command, see [HERMES_VOICE.md](./HERMES_VOICE.md).

## Install

Follow the upstream Hermes Agent install guide: <https://hermes-agent.nousresearch.com>.

Verify the CLI works directly first:

```bash
hermes chat -Q -q "hello"
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=hermes
# optional overrides
HERMES_COMMAND="hermes chat -Q -q"           # default
HERMES_HOME=/Users/you/.hermes               # per-instance Hermes home
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0                     # 0 = no limit
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

The session file lives at `<repo>/.verbalcoding-session` by default (override with `HERMES_SESSION_FILE`).

## Session resume

Hermes is the only built-in adapter with session resume. After each successful turn the adapter writes the new `session_id` to disk and prepends `--resume <id>` to the next call. `!session reset` (or `!reset-session`) clears that file.

If a turn aborts before Hermes emits `session_id:` on stderr, the adapter also reads the Hermes session JSON at `~/.hermes/sessions/session_<id>.json` to recover the last assistant message.

## Verbose progress

In verbose mode the adapter drops Hermes' `-Q` quiet flag so stdout streams `┊ <emoji> <tool>` previews. These get summarized into one-line progress events (file reads, web search, terminal). Without verbose, only the final boxed answer plays.

## Voice phrases to switch TO Hermes

- en: `"switch to Hermes"`, `"ask Hermes ..."`
- ko: `"헤르메스로 전환"`, `"헤르메스한테 물어봐"`

## Gotchas

- The TTS prefix on cross-agent handoff uses the localized label: `"Hermes says: "` / `"헤르메스: "`.
- `HERMES_HOME` is the most common per-project isolation knob; per-instance `.env` typically sets `HERMES_HOME=/Users/you/.hermes/profiles/<project>`.
- If verbose progress is on and Hermes still finishes with an empty box (timed out), the adapter scrapes the session JSON for the final assistant text before giving up.
