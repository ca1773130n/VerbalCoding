# OpenClaw — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

OpenClaw is an open-source terminal coding agent. VerbalCoding drives it through `openclaw run`.

## Install

Follow the upstream OpenClaw install guide. Confirm:

```bash
openclaw run "hello"
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=openclaw
# optional
OPENCLAW_COMMAND="openclaw run"             # default
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Voice phrases to switch TO OpenClaw

- en: `"switch to OpenClaw"`, `"ask OpenClaw ..."`, `"switch to open claw"`
- ko: `"openclaw로 전환"`

The matcher accepts `openclaw` and `open claw`.

## Gotchas

- **No session resume** in the default command. Add a resume flag via `OPENCLAW_COMMAND` if your build supports one.
- **Verbose progress.** Same as OpenCode — keyword-based labels unless `SMART_PROGRESS_API_KEY` is configured for the LLM summarizer.
- **Naming clash.** Both the parser alias `openclaw` and the user-facing label `OpenClaw` are distinct from `claude` / `claude code`; the strict-mode router won't conflate them.
