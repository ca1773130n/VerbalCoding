# VerbalCoding Roadmap — 2026 H1 Differentiation Push

> Reframe: from "Discord bridge for Hermes" → **the voice layer for any coding agent — with real barge-in, streaming latency, and the agents you already use.**

This roadmap covers five differentiation phases that separate VerbalCoding from Hermes' built-in `/voice` (shipped Mar 2026, ~2 months old, no barge-in, Hermes-only, 2.5–9s practical latency).

## Phase Plans

| # | Phase | Status | Plan |
|---|---|---|---|
| 1 | Streaming end-to-end pipeline | shipped | [phase1-streaming-pipeline.md](./superpowers/plans/2026-05-13-phase1-streaming-pipeline.md) |
| 2 | Agent-agnostic adapter completion | shipped (incl. cross-agent voice routing) | [phase2-agent-adapters.md](./superpowers/plans/2026-05-13-phase2-agent-adapters.md), [cross-agent-voice-transfer.md](./superpowers/plans/2026-05-14-cross-agent-voice-transfer.md) |
| 6 | Smart progress summarization | shipped | [phase6-smart-progress.md](./superpowers/plans/2026-05-13-phase6-smart-progress.md) |
| 7 | Voice plan mode | shipped (incl. `which_agent` slot) | [phase7-voice-plan-mode.md](./superpowers/plans/2026-05-13-phase7-voice-plan-mode.md) |
| 10 | Push notification handoff | shipped | [phase10-push-notifications.md](./superpowers/plans/2026-05-13-phase10-push-notifications.md) |

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

## What's next (2026 H2 candidates)

The differentiation push above shipped — the foundation is in. Candidate next phases, not yet planned:

| # | Candidate | Why | Status |
|---|---|---|---|
| 11 | Push-to-talk and wake-word v2 | Reduce false barge-ins in shared rooms; pair with hardware push-to-talk via a Discord overlay or a key-binding companion. | candidate |
| 12 | Multi-user voice in one VC | Each speaker resolves to a distinct routing/session; per-speaker plan-mode and decision answers. Builds on the per-channel routing state. | candidate |
| 13 | Output voice cloning per agent | Distinct voices per backend (e.g. Codex gets a different TTS voice than Claude Code); piggybacks on the existing voice-clone capture flow. | candidate |
| 14 | Latency benchmarking + regression gate | Codify the latency_metrics output into a benchmark harness + CI threshold so any regression in STT/agent/TTS stages is caught. | candidate |
| 15 | Phone-app companion (deferred) | The push-handoff notification deeplinks back to Discord today; a thin phone app or PWA could replay a redacted transcript on demand. | candidate |
| 16 | Voice-clone reference auto-detect | Detect that an OpenVoice/FireRedTTS reference sample is missing and propose `!voice-clone capture` proactively when the user selects a clone-only backend. | candidate |

These aren't sequenced yet. Phases 11/12/14 are the highest-leverage if the goal is making the bridge feel solid in shared rooms; 13/16 are quality-of-life on top of the existing voice stack.
