# Codex — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

Codex CLI is OpenAI's terminal coding agent. VerbalCoding drives it through `codex exec`. Because `codex exec` writes its final assistant text to a temp file when `--output-last-message <path>` is passed, the adapter inserts that flag automatically and reads the file back even if stdout is noisy.

## Install

```bash
npm install -g @openai/codex
codex login              # or set OPENAI_API_KEY for headless use
codex exec "hello"
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=codex
# optional
CODEX_COMMAND="codex exec"                      # default
AGENT_PROJECT_CONTEXT="What we're working on, what's already decided."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE` is unused (Codex `exec` is stateless across calls).

## Output capture

For Codex, the adapter:

1. Generates a temp path under `os.tmpdir()` like `verbalcoding-codex-last-<pid>-<ts>.txt`.
2. Inserts `--output-last-message <path>` immediately before the final positional prompt arg.
3. After the run, reads that file as the authoritative answer (preferred over `stdout`).
4. Deletes the temp file.

This is robust to Codex emitting tool-use chatter on stdout; the spoken answer always comes from the captured file.

## Voice phrases to switch TO Codex

- en: `"switch to Codex"`, `"ask Codex what it thinks"`
- ko: `"코덱스로 전환"`, `"코덱스한테 물어봐"`

## Gotchas

- **Long tasks.** Set `AGENT_TASK_TIMEOUT_MS=0` for codegen runs that may take minutes. The adapter respects `signal.aborted` so barge-in still cuts cleanly.
- **No session resume.** Pass context via `AGENT_PROJECT_CONTEXT` and rely on the cross-agent handoff block for continuity after a route change.
- **Patch-like output safety.** If a turn is interrupted and Codex was mid-diff, the bridge does **not** read the diff aloud — it speaks an "interrupted" notice and asks you to check the text channel.
- **Auth.** A 401 from the OpenAI backend surfaces as a non-zero exit; the bridge reports the failure and the cross-agent fallback prompt offers the default agent.
