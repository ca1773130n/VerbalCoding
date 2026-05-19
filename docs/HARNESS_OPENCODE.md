# OpenCode — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

OpenCode is an open-source terminal coding agent. VerbalCoding drives it through `opencode run`.

## Install

Follow the upstream OpenCode install guide. Confirm:

```bash
opencode run "hello"
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=opencode
# optional
OPENCODE_COMMAND="opencode run"             # default
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Voice phrases to switch TO OpenCode

- en: `"switch to OpenCode"`, `"ask OpenCode ..."`, `"switch to open code"`
- ko: `"opencode로 전환"`, `"오픈코드로 전환"`

The matcher accepts `opencode` and `open code`.

## Gotchas

- **No session resume** in the default command. If your OpenCode build supports a resume flag, append it via `OPENCODE_COMMAND="opencode run --resume"` (the adapter passes the prompt as the final positional arg).
- **Model choice.** Append `--model` flags via `OPENCODE_COMMAND` if your OpenCode build expects them.
- **Verbose progress.** Whatever events OpenCode prints on stdout/stderr get keyword-matched (file reads, web search, terminal); without `SMART_PROGRESS_API_KEY` the bridge falls back to those raw labels.
