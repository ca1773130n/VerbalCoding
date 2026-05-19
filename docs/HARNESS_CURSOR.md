# Cursor CLI — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

Cursor CLI (`cursor-agent`) is Cursor's terminal agent. VerbalCoding drives it through `cursor-agent --print --prompt`, passing the user's transcribed utterance as the prompt value. `--print` keeps the run non-interactive.

## Install

Follow the upstream Cursor CLI install. Confirm:

```bash
cursor-agent --print --prompt "hello"
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=cursor                                       # alias 'cursor-cli' also accepted
# optional
CURSOR_COMMAND="cursor-agent --print --prompt"             # default
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Voice phrases to switch TO Cursor

- en: `"switch to Cursor"`, `"ask Cursor ..."`, `"switch to cursor cli"`, `"switch to cursor agent"`
- ko: `"커서로 전환"`, `"cursor한테 물어봐"`

The matcher accepts `cursor`, `cursor cli`, `cursor-cli`, `cursor agent`, and `cursor-agent`.

## Gotchas

- **Prompt placement.** `--prompt` expects the value to follow; VerbalCoding's shell-aware argv builder places the transcribed utterance as the final positional argument, so `CURSOR_COMMAND` must end with `--prompt`.
- **Editor side-effects.** Cursor's CLI may touch local cursor-related state files in the working directory; if that's surprising for a voice-only flow, point `AGENT_WORKDIR` at an isolated project dir.
- **No session resume.** Use `AGENT_PROJECT_CONTEXT` for cross-turn continuity, plus the cross-agent handoff block when routing back from a different harness.
- **Patch safety.** If Cursor returns a diff and the turn is interrupted, the bridge does not read the diff aloud.
