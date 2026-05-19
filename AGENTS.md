# Repository Guidelines

VerbalCoding is a Discord voice bridge for coding agents. The active runtime is the Node implementation under `app-node/`, launched through `run.sh` or the `vc` CLI.

## Module layout (app-node/)

- `main.mjs` — Discord/voice/agent dispatcher and lifecycle (heaviest file).
- `agent_adapters.mjs` + `agent_contract.mjs` — backend-specific CLI adapters (Hermes/Claude/Codex/Gemini/OpenCode/OpenClaw/Aider/Cursor/custom) behind a shared contract.
- `agent_routing.mjs` — voice-driven cross-agent routing (`parseAgentRoutingCommand`, `resolveBackendAlias`, `isRoutingOnlyUtterance`, `renderAgentPrefix`, `buildCrossAgentPrompt`, `buildFallbackDecision`, `isAgentRoutingDecision`). User-facing docs in `docs/USAGE.md`.
- `plan_mode.mjs` — voice plan-mode state machine; recognizes the `which_agent` decision slot.
- `stream_sentencer.mjs` + `streaming_tts_queue.mjs` — incremental TTS pipeline with code-fence stripping and synth-failure surface.
- `tts_backends.mjs` + `tts_voice_config.mjs` — TTS backend factories with a shared `onFallback` hook for one-shot user notices.
- `bridge_state.mjs`, `project_sessions.mjs`, `text_routing.mjs` — voice/text-channel state and per-channel routing isolation.

## Development

- Prefer user-facing `vc ...` commands over `npm run vc -- ...` in docs and examples.
- Keep local secrets in `.env` or `instances/*.env`; do not commit real Discord tokens, channel IDs, session files, voice samples, model weights, virtualenvs, logs, or cache output.
- Update source files rather than generated/runtime artifacts.
- Keep examples public-safe: use placeholders for local paths, user IDs, Discord IDs, and tokens.

## Verification

Run the Node test suite before reporting code changes as complete:

```bash
npm test
```
