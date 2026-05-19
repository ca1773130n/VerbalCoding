# Coding Agent Harnesses

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="README.md">Docs hub</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.md">Troubleshooting</a>
</p>

VerbalCoding is agent-agnostic. It drives whichever CLI coding agent you have installed by spawning it once per voice turn, feeding the transcript as a prompt, and speaking the response back. Pick **one** as your default; the cross-agent voice routing lets you reach the others mid-session.

| Harness | Default command | Session resume | Per-harness doc |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.md](./HERMES_VOICE.md) (positioning) + [HARNESS_HERMES.md](./HARNESS_HERMES.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.md](./HARNESS_CLAUDE.md) |
| Codex | `codex exec` | ❌ (output-last-message capture) | [HARNESS_CODEX.md](./HARNESS_CODEX.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.md](./HARNESS_GEMINI.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.md](./HARNESS_OPENCODE.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.md](./HARNESS_OPENCLAW.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.md](./HARNESS_AIDER.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.md](./HARNESS_CURSOR.md) |

## Pick your default

`vc setup` auto-detects installed binaries and lets you pick. Non-interactive override:

```bash
# .env or instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

Each harness picks up its own command from a matching env var (`HERMES_COMMAND`, `CLAUDE_COMMAND`, etc.). The shared envs `AGENT_LABEL`, `AGENT_COMMAND`, `AGENT_SESSION_FILE`, `AGENT_WORKDIR`, `AGENT_PROJECT_CONTEXT`, `AGENT_TASK_TIMEOUT_MS`, `AGENT_CHAT_TIMEOUT_MS`, `AGENT_VERBOSE_PROGRESS` override per-harness defaults when set.

## Routing between harnesses by voice

Once configured, you can reach any **installed** harness from a voice channel without restarting:

- `"ask Codex what it thinks"` — single-turn route, next utterance returns to the default.
- `"switch to Aider"` — sticky route until you say `"back to default"`.
- Plan-mode `which_agent` slot — the agent itself proposes which backend runs the next plan.

The routing layer detects whether the binary is on `PATH` (resolving relative commands against the active project session's workdir). If not installed, the bridge asks `"Want me to use the default agent instead?"` — answer `"yes"` to fall back or `"no"` to cancel.

Aliases recognized by the parser: `claude` / `claude code`, `codex` / `코덱스`, `gemini` / `gemini cli` / `제미나이`, `opencode`, `openclaw`, `aider` / `에이더`, `cursor` / `cursor cli`, `hermes` / `헤르메스`.

## Shared semantics

Things every harness adapter respects:

- **Voice plan mode** — `"plan it first"` → narrate a plan; edit by voice; `"approve"` to execute against the chosen harness.
- **Barge-in** — interrupting cuts the current TTS and aborts the agent task. Sticky routing survives interrupts; only single-turn routes are cleared.
- **Verbose progress** — `AGENT_VERBOSE_PROGRESS=1` (or `"상세 진행 켜"`) prints structured progress events the harness emits (file reads, web search, tool use). Smart-progress, if `SMART_PROGRESS_API_KEY` is set, summarizes these into one sentence per batch.
- **Push handoff** — `NOTIFY_PROVIDER=ntfy|pushover` plus `NOTIFY_MIN_TASK_MS` fires a push notification when a long task completes and the voice channel is empty. Debounced by body + `NOTIFY_DEBOUNCE_MS`.
- **Per-channel state** — each Discord voice channel keeps its own routing, plan-mode, and recent-utterance ring buffer.
- **Project sessions** — `!session new <name> <workdir>` binds a Discord channel to a project; per-(harness, session) adapters are cached and invalidated on rebind.

See per-harness docs for install paths, auth, and gotchas. `docs/CONFIGURATION.md` is the canonical env-var reference.
