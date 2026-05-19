# Gemini CLI — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

Gemini CLI is Google's terminal coding agent. VerbalCoding drives it through `gemini -p`. Each voice turn is one invocation; there is no built-in session-resume across calls.

## Install

Follow the upstream Gemini CLI install guide. Confirm:

```bash
gemini -p "hello"
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=gemini
# optional
GEMINI_COMMAND="gemini -p"                  # default; add --model, --debug as needed
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Voice phrases to switch TO Gemini

- en: `"switch to Gemini"`, `"ask Gemini ..."`, `"switch to Gemini CLI"`
- ko: `"제미나이로 전환"`, `"gemini한테 물어봐"`

The matcher accepts `gemini`, `gemini cli`, `gemini-cli`, and `제미나이`.

## Gotchas

- **No session resume.** Same continuity story as Claude / Codex: rely on `AGENT_PROJECT_CONTEXT` and the cross-agent handoff block.
- **Long answers.** Gemini sometimes returns large structured responses; the stream sentencer splits them into TTS-able sentences. Code fences are stripped from speech (the text channel still gets the full answer with code).
- **API key.** If Gemini exits non-zero with an auth error, the bridge reports the message; the cross-agent fallback prompt offers the default agent if Gemini was a non-default route.
- **Verbose progress.** Gemini's stdout doesn't follow Hermes' `┊`-style preview format, so verbose progress mostly relies on the smart-progress LLM summarizer.
