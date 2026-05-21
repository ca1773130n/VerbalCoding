# Phase 11 — Push-to-Talk + Wake-Word v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate wake misses and unwanted barge-ins by (a) adding an opt-in **push-to-talk gate** that suppresses whisper-cli unless the user opens a turn, and (b) replacing regex-on-transcript wake detection with a **continuous neural wake-word detector** tapped off the PCM stream — both behind feature flags in one increment.

**Motivation:** `subscribeUser()` records every Discord speaking-start to WAV (`main.mjs:2089-2141`), runs whisper-cli, then post-filters via `acceptsWake()` (`main.mjs:1582-1585`, `:1792`). This wastes 300-900 ms per false trigger and leaks nearby-conversation transcripts. Hardware PTT keys aren't visible to bots, so we need a software gate. Wake-word v2 reacts in <200 ms on a user-trained phrase without relying on whisper accuracy.

**Architecture:**

1. **PTT gate (`app-node/ptt_gate.mjs`, new).** Pure module: `createPttGate({ mode })` with `isOpen(userId)`, `open(userId, { ttlMs })`, `close(userId)`. `subscribeUser()` consults it before WAV-writer allocation (`main.mjs:2100`); when closed, the opus stream is drained and whisper skipped. **Decision: slash-command pair `/ptt start|stop|status`**, registered via `client.application.commands` on `ready`. Justification:
   - Discord's built-in *Push to Talk* setting only affects the human's outbound audio — bots receive packets either way, so it's invisible server-side.
   - A WebRTC companion needs a sidecar per user, OS keybinding daemons, signalling channel; high install cost.
   - Slash commands work on desktop + mobile, zero install, per-guild ACL'd. Default `ttlMs=20000` auto-closes on forgotten stop.
   - **Future work (out of scope):** WebRTC companion using `node-global-key-listener` + localhost WS toggling the same gate for true hold-to-talk.

2. **Wake-Word v2 (`app-node/wake_detector.mjs`, new).** Streaming detector wrapping **openWakeWord** (Apache-2.0, `onnxruntime-node`, ~30 ms hop, CPU-only). Picovoice rejected (per-user license, closed weights); Kyutai rejected (no shipped wake model). Consumes a tee of the 16 kHz mono PCM from the `prism.opus.Decoder` chain in `subscribeUser()` (`main.mjs:2109-2141`) — insert a `PassThrough` between `decoder` and `writer`, fork a downsampler into the detector. On score >`WAKE_WORD_THRESHOLD` (default 0.55) it calls `pttGate.open(userId, { ttlMs: WAKE_WORD_TURN_MS })`. Custom phrases via openWakeWord's `train_custom_verifier`; models in `models/wake/`.

3. **State plumbing (`app-node/bridge_state.mjs`).** Extend `createBridgeState()` (`bridge_state.mjs:1`) with `setGateMode/getGateMode` so `/ptt`, voice commands ("PTT 켜"/"push to talk on" per `voice_messages.mjs`), and wake hits share one source of truth. `barge_in.mjs` unchanged; gate runs **before** `createLiveBargeInMonitor()` (`main.mjs:2115`), so explicit barge-in still works while gated.

**Tech Stack:** Node 20 ESM, `onnxruntime-node`, `discord.js` slash commands, `node --test`. Models: openWakeWord baseline + user-trained `hermes_v1.onnx`.

## Tasks

### Task 1: Failing tests for `ptt_gate`

**Files:** Create `app-node/ptt_gate.test.mjs`. Cover: default closed in `mode='ptt'`; always open in `mode='off'` (legacy); `open()` expires after `ttlMs`; `close()` is idempotent; per-user isolation.

### Task 2: Implement `ptt_gate.mjs`

Pure module, no Discord deps. Inject `now`/`setTimeout` for testability. Export `createPttGate({ mode, defaultTtlMs, log })`.

### Task 3: Register `/ptt` + wire gate into `subscribeUser`

**Files:** `app-node/main.mjs`. On `ClientReady`, register guild command `ptt` (`start|stop|status`). Add `interactionCreate` handler. In `subscribeUser()` insert gate check after the allow-check at `main.mjs:2090` — if closed, drain `receiver.subscribe(...)` and return before line 2109. Short-circuit the whisper post-filter at `main.mjs:1792` to skip `acceptsWake` when the detector confirmed the turn (carry a `viaWakeDetector` flag on the pending utterance).

### Task 4: Failing tests for `wake_detector`

**Files:** `app-node/wake_detector.test.mjs`. Inject a fake ORT session; feed canned PCM frames; assert callback fires once per detection with cooldown.

### Task 5: Implement `wake_detector.mjs`

Streaming class with 1280-sample (80 ms) frame buffer, 480 ms ring, cooldown 1500 ms, score smoothing over 3 frames. Lazy-load the ONNX model from `WAKE_WORD_MODEL` (default `models/wake/hermes_v1.onnx`). Fallback to legacy `acceptsWake` when model load fails — log once, never crash bridge.

### Task 6: Tap PCM stream + integrate detector

**Files:** `app-node/main.mjs:2109-2141`. Replace `opusStream.pipe(decoder).pipe(writer)` with a fork: decoder → PassThrough → [writer, downsampler16k → detector.feed()]. Detector callback flips the gate open and stamps `pending.viaWakeDetector = true` via `bridgeState.setPending` (`bridge_state.mjs:28`).

### Task 7: Settings + voice commands

**Files:** `.env.example`, `main.mjs:205-220`, `voice_messages.mjs`. Add `PTT_MODE=off|ptt|wake|wake+ptt` (default `off`), `WAKE_WORD_MODEL`, `WAKE_WORD_THRESHOLD`, `WAKE_WORD_TURN_MS`. Recognize "PTT 켜/꺼", "wake word on/off" per `docs/HARNESSES.md` shared-semantics.

### Task 8: Docs

Update `docs/HARNESSES.md` shared-semantics with PTT + wake-v2 entries. Add `docs/PTT_AND_WAKEWORD.md` covering custom-verifier training and latency budget (detection→gate-open <200 ms).

## Verification

- `node --test app-node/ptt_gate.test.mjs app-node/wake_detector.test.mjs` → PASS.
- Full `node --test` suite → no regressions in `barge_in.test.mjs`, `bridge_state.test.mjs`.
- Manual `PTT_MODE=ptt`: speaking without `/ptt start` → zero whisper invocations (no `pcmBytes` log at `main.mjs:2133`).
- Manual `PTT_MODE=wake`: trained phrase opens gate <200 ms (new `wakeDetectMs` field in `latency_metrics.mjs`).
- Manual: barge-in during TTS still aborts (`main.mjs:2115` path unaffected).

## Out of scope

- WebRTC/keyboard PTT companion (future task; gate is companion-ready).
- Multi-wake-word arbitration per user.
- Server-side VAD replacement (`SUBSCRIBE_AFTER_SILENCE_MS` stays).
- Whisper streaming partials.

## Self-Review

- Gate + detector share one bridge_state field → no split-brain.
- Default `PTT_MODE=off` keeps current behavior; opt-in only.
- ONNX load failure degrades to today's regex path, never crashes.
- All new modules are pure + injected deps → unit-testable without Discord.
