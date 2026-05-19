# Claude Code — Harness Notes

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="HARNESSES.md">Harnesses</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a>
</p>

Claude Code is Anthropic's official terminal-resident coding agent. VerbalCoding drives it through `claude -p`, where each voice turn is one invocation. Claude Code does not expose a stable session-resume contract over `-p`, so each call is a fresh context — use `AGENT_PROJECT_CONTEXT` and the cross-agent handoff block to keep continuity.

## Install

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"     # confirm it answers
```

## Configure VerbalCoding

```bash
# .env
AGENT_BACKEND=claude              # alias 'claude-code' also accepted
# optional
CLAUDE_COMMAND="claude -p"        # default; override e.g. to add --model, --debug
AGENT_PROJECT_CONTEXT="Working on the auth module; previous decisions: oauth=github."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE` defaults to `<repo>/.agent-sessions/claude` but is **unused** by this harness — Claude Code's `-p` is stateless. Leave it set; it just becomes a no-op.

## What Claude sees per turn

Every turn the adapter prepends a Discord-aware preamble (English or Korean depending on `VOICE_LANGUAGE`), the project context, recent Discord text context, and finally the user's transcribed utterance. On cross-agent handoff (e.g. you said `"ask Codex ..."` last turn and just spoke again), the prepended block also includes a "Recent user voice" line of up to the last 4 utterances plus the most recently resolved plan decisions, so Claude doesn't start cold.

## Verbose progress

Claude Code does not emit a standard progress stream over `-p`. `AGENT_VERBOSE_PROGRESS=1` still works — the adapter parses tool/file/web mentions out of stdout/stderr if Claude prints them — but expect coarser progress than Hermes.

## Voice phrases to switch TO Claude Code

- en: `"switch to Claude Code"`, `"ask Claude ..."`, `"let Claude finish this"`
- ko: `"클로드로 전환"`, `"claude한테 물어봐"`

The matcher accepts both `claude` and `claude code` as aliases; strict mode (used for routing-only utterances) requires an exact alias.

## Gotchas

- **No session resume.** A long-running pair-programming session needs the cross-agent handoff context block to carry decisions forward. The bridge does this automatically on backend changes; within the same backend, set `AGENT_PROJECT_CONTEXT` to a short summary.
- **Quoted command paths.** If `CLAUDE_COMMAND` uses a quoted absolute path (e.g. `"/Applications/Claude Code/claude" -p`), VerbalCoding's installation probe uses `shellSplit` and honors quotes correctly.
- **Auth refresh.** `claude login` token expiry surfaces as a non-zero exit; the bridge reports the failure and (if a non-default backend) the fallback prompt will offer to retry on the default.
- **Patch-like output.** If Claude returns a diff and the turn is interrupted, the bridge says `"the agent was interrupted; check the text channel for files and tests"` rather than reading the diff aloud.
