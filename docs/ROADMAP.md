# VerbalCoding Roadmap — 2026 H1 Differentiation Push

> Reframe: from "Discord bridge for Hermes" → **the voice layer for any coding agent — with real barge-in, streaming latency, and the agents you already use.**

This roadmap covers five differentiation phases that separate VerbalCoding from Hermes' built-in `/voice` (shipped Mar 2026, ~2 months old, no barge-in, Hermes-only, 2.5–9s practical latency).

## Phase Plans

| # | Phase | Status | Plan |
|---|---|---|---|
| 1 | Streaming end-to-end pipeline | designed | [phase1-streaming-pipeline.md](./superpowers/plans/2026-05-13-phase1-streaming-pipeline.md) |
| 2 | Agent-agnostic adapter completion | partial → designed | [phase2-agent-adapters.md](./superpowers/plans/2026-05-13-phase2-agent-adapters.md) |
| 6 | Smart progress summarization | designed | [phase6-smart-progress.md](./superpowers/plans/2026-05-13-phase6-smart-progress.md) |
| 7 | Voice plan mode | designed | [phase7-voice-plan-mode.md](./superpowers/plans/2026-05-13-phase7-voice-plan-mode.md) |
| 10 | Push notification handoff | designed | [phase10-push-notifications.md](./superpowers/plans/2026-05-13-phase10-push-notifications.md) |

## Sequencing rationale

1. **Phase 2 first** — adapter polish + Aider/Cursor + auto-detection. Foundational and unlocks marketing claim "any coding agent".
2. **Phase 1** — extend the existing `tts_prefetch.mjs` to consume streaming stdout. Big perceived-latency win.
3. **Phase 6** — replaces regex pattern matching with semantic summarization. Demo moment.
4. **Phase 7** — voice plan mode. UX feature, depends on adapter capability flags from Phase 2.
5. **Phase 10** — push notification handoff. Independent; ship after the core is tighter.

## Differentiation claims this roadmap unlocks

- **True barge-in** with smart resume (extend existing `barge_in.mjs`).
- **Streaming pipeline** so first audio plays before the agent finishes thinking (Hermes Phase-4 wishlist).
- **Agent-agnostic** — Hermes, Claude Code, Codex, Gemini, OpenCode, OpenClaw, Aider, Cursor CLI, custom.
- **Smart narration** — describes intent, not file names.
- **Voice plan mode** — narrate plan, edit by voice (`"skip step 3"`).
- **Phone-down mode** — push notification when long task completes with voice summary.

## Non-goals (for this cycle)

- PSTN bridge / actual phone calls (Phase 4 of the broader pitch; deferred).
- Local-first one-flag preset (Phase 5; deferred but trivial follow-up).
- Multi-agent in one VC with distinct voices (Phase 3; needs Phase 2 to land first).
