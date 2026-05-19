# Aider — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

Aider is a pair-programming AI CLI focused on direct edits. VerbalCoding drives it through `aider --no-pretty --yes-always --message` — the prompt is passed as the `--message` value so each voice turn becomes one non-interactive Aider run that may modify files in `AGENT_WORKDIR`.

## Install

```bash
pip install aider-chat
aider --version
# Confirm a single-message run works:
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider needs an API key for the model you point it at (OpenAI / Anthropic / a local server). See <https://aider.chat>.

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=aider
# optional
AIDER_COMMAND="aider --no-pretty --yes-always --message"   # default
AGENT_WORKDIR=/Users/you/code/your-project                 # where Aider should edit
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000                               # Aider can take longer
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty` strips Rich-formatting box characters so the stream sentencer doesn't choke on them. `--yes-always` keeps the run non-interactive (Aider won't pause for "apply this diff?" prompts).

## Voice phrases to switch TO Aider

- en: `"switch to Aider"`, `"ask Aider to ..."`
- ko: `"aider로 전환해줘"`, `"에이더로 전환"`

The matcher accepts `aider` and `에이더`.

## Gotchas

- **Aider edits files.** Unlike Claude / Codex / Gemini under `-p`, Aider directly modifies the working tree as part of answering. Be deliberate about `AGENT_WORKDIR` — usually a project session's `workdir`.
- **Diffs in output.** Aider often emits diff-shaped text. If a turn is interrupted, the bridge speaks an "interrupted" notice and skips reading the diff aloud — check the text channel and `git status`.
- **Auth.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` need to be in Aider's environment; instance-isolated installs typically use `instances/<project>.env`.
- **Per-channel state.** Cross-agent routing is per Discord channel; switching to Aider in one project room does not affect another.
