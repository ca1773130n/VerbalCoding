# Phase 14 — VerbalBench: Voice-Coding Agent Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship "VerbalBench" — the first end-to-end benchmark for voice-mediated coding agents. SWE-bench / Terminal-Bench measure text-only batch tool loops; nothing measures speech-to-first-tool-action latency, barge-in resilience, TTS-while-acting throughput, or cross-agent handoff fidelity. Deliver a 50-task suite, Discord-free harness, JSON leaderboard, CI smoke-bench.

**Architecture:** Node driver synthesizes user audio (Edge-TTS + samples), feeds it through a mock `receiver` matching the `@discordjs/voice` surface in `main.mjs:2089–2161` (`receiver.subscribe → prism.opus.Decoder → wav.FileWriter` at `main.mjs:2107–2118`). Harness boots the bridge in-process with `MOCK_DISCORD=1`, captures timing via `createLatencyTurn` (`main.mjs:314`, `latency_metrics.mjs:29`) plus a new `metricsTurn.mark('first_tool_action')`, writes JSONL.

**Tech Stack:** Node 20 ESM, `node --test`, Edge-TTS, existing `tts_backends.mjs` + `stt_whisper.mjs`, GitHub Actions.

## Spec

### Task taxonomy (10 × 5 = 50)

| Category | Seed |
|---|---|
| codegen | "Write a Python flatten-nested-list." |
| refactor | "Extract auth in `routes/user.js` into middleware." |
| run-tests | "Run the suite; tell me what fails." |
| debug-failing-test | "Fix the failing test in `test_parser.py`." |
| web-research-then-code | "Look up OpenAI Realtime audio schema, patch our client." |
| switch-backend-mid-task | "Use Codex." → mid-turn: "Switch to Claude." |
| plan-mode-then-execute | "Plan a refactor of `bridge_state.mjs`, then do it." |
| barge-in-and-redirect | Mid-TTS: "Stop. Tests first." |
| push-handoff-and-resume | "Push to my desktop; pick up there." |
| multi-file-edit | "Rename `whisperBin` to `sttBin` project-wide." |

Five fixtures per category at `bench/tasks/<category>/NN-<slug>.json` with `{ id, prompt_audio_seed, expected_tool_classes, success_predicate, max_wall_ms }`.

### Mock receiver (`bench/mock_discord.mjs`)

Implements only what `main.mjs:2089–2118, 2148–2165` touches:

- `joinVoiceChannel` → returns `{ receiver, on('stateChange'), subscribe(player) }`; emits `VoiceConnectionStatus.Ready` synchronously.
- `receiver.speaking.on('start', cb)` driven by harness `inject(userId, wavPath)`.
- `receiver.subscribe(userId, opts)` → `Readable` yielding Opus packets re-encoded from `bench/audio/*.wav`; honors `EndBehaviorType.AfterSilence`.
- `createAudioPlayer/createAudioResource` → captures PCM into `turn.tts_pcm[]` with first-byte timestamp.

### Metrics (`bench/metrics.mjs`, extends `latency_metrics.mjs`)

- `speech_to_first_tool_action_ms` — `voice_first_packet` (`main.mjs:1665,1694`) → first adapter tool-event (`main.mjs:~1985`, new `metricsTurn.mark('first_tool_action')`).
- `first_utterance_of_speech_ms` — `voice_first_packet` → first TTS PCM byte from the mock player.
- `task_completion` — `success_predicate(workdir)` boolean.
- `barge_in_success_rate` — `barge-in-and-redirect` only: second-utterance onset → `metricsTurn.finish({ status: /barge_in_/ })` (`main.mjs:1726,1737`). Pass ≤ 600 ms.
- `handoff_fidelity` — `switch-backend-mid-task` only: assert routed `promptForAgent` contains `[Session ontology]` block (`main.mjs:1955–1958`) and that turn-N ontology nodes appear in turn-N+1 prompt.

### Baselines

Run across all eight backends in `buildAgentSettings` defaults (`agent_adapters.mjs:217–276`): hermes, claude, codex, gemini, opencode, openclaw, aider, cursor. Publish backend × category matrix.

### JSON result row (sample)

```json
{
  "bench_version": "0.1.0",
  "run_id": "2026-05-21T14:22:01Z-abc123",
  "backend": "claude",
  "task_id": "barge-in-and-redirect/03-stop-run-tests",
  "speech_to_first_tool_action_ms": 1820,
  "first_utterance_of_speech_ms": 2410,
  "barge_in_ms": 420,
  "task_completion": true,
  "handoff_fidelity": null,
  "wall_ms": 18430,
  "tts_chars": 312,
  "tool_calls": ["read_file", "terminal"],
  "harness_sha": "b76257f",
  "agent_command": "claude -p"
}
```

Superset of HF Open Leaderboard rows (`task_id`, `model`→`backend`, numeric metrics) so the same parser ingests both.

### Publishing

- `bench/results/` JSONL pushed by CI to `gh-pages`; static leaderboard in `bench/site/` (Vite + sortable table).
- `npm run bench:smoke` — 10 tasks (1/category, ≤ 3 min) on every PR via `.github/workflows/verbalbench-smoke.yml`.
- `npm run bench:full` — 50 × 8 nightly; artifact uploaded, PR-commented if `speech_to_first_tool_action_ms` p95 regresses > 15 % vs. baseline.

## File Structure

- Create: `bench/mock_discord.mjs` — `@discordjs/voice` doubles for `main.mjs:2089–2165`.
- Create: `bench/driver.mjs`, `bench/metrics.mjs`, `bench/predicates/*.mjs`.
- Create: `bench/tasks/<10 dirs>/*.json` (50 fixtures), `bench/audio/` (Edge-TTS WAVs, ko+en).
- Create: `bench/results/baseline-2026-05-21.jsonl`, `bench/site/`.
- Create: `.github/workflows/verbalbench-{smoke,nightly}.yml`.
- Modify: `app-node/main.mjs:1985` — `metricsTurn.mark('first_tool_action')` gated by `VERBALBENCH_INSTRUMENT=1`.
- Modify: `app-node/main.mjs:165` — `MOCK_DISCORD=1` skips real Discord login.
- Modify: `app-node/agent_adapters.mjs:594` — `ask` accepts optional `plan.onFirstToolEvent`; fired on first parsed tool-call. No-op when absent.
- Modify: `app-node/latency_metrics.mjs:29` — record `first_tool_action`, `barge_in_ms`.
- Modify: `package.json` — `bench:smoke`, `bench:full`, `bench:render`.
- Modify: `README.md` — Benchmarks section.
- Create: `docs/VERBALBENCH.md` — contributor guide + `npm run bench:adapter -- --adapter ./my-adapter.mjs`.

## Tasks

### Task 1: Failing test for mock receiver

**Files:** Create `bench/mock_discord.test.mjs`.

- [ ] Step 1: Assert `mockReceiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 2200 } })` emits bytes of `bench/audio/fixtures/hello.wav` then `end`s. Run `node --test bench/mock_discord.test.mjs` — expect FAIL.

### Task 2: Implement `bench/mock_discord.mjs`

- [ ] Step 1: Implement Spec surface. Wrap WAV as Opus `Readable` at 48 kHz/2-ch (matches `prism.opus.Decoder` at `main.mjs:2110`).
- [ ] Step 2: PASS → commit `feat(bench): mock @discordjs/voice receiver`.

### Task 3: Driver + metrics + instrumentation

- [ ] Step 1: `bench/driver.mjs` boots bridge with `MOCK_DISCORD=1`, calls `mockReceiver.inject(...)`, awaits `metricsTurn.finish`, writes JSONL.
- [ ] Step 2: `bench/metrics.mjs` extensions.
- [ ] Step 3: Wire `main.mjs:1985` and `agent_adapters.mjs:594` per File Structure. Tests for both. Commit.

### Task 4: First 10 fixtures + smoke CI

- [ ] Step 1: One task per category with Edge-TTS audio + predicate.
- [ ] Step 2: `npm run bench:smoke` green locally.
- [ ] Step 3: `.github/workflows/verbalbench-smoke.yml` (hermes on PR; full matrix on `workflow_dispatch`). Commit.

### Task 5: Remaining 40 fixtures + baseline

- [ ] Step 1: Author 4 more per category.
- [ ] Step 2: Run full matrix on installed backends (`detectInstalledAgents`); commit `bench/results/baseline-2026-05-21.jsonl` + nightly workflow.

### Task 6: Leaderboard site + docs

- [ ] Step 1: `bench/site/` (sortable, per-metric filters, JSON download).
- [ ] Step 2: `docs/VERBALBENCH.md` + `README.md` update. Commit.

## Self-Review

- Coverage: taxonomy, mock, metrics, baselines, publishing — present.
- No placeholders; units ms; sample row included.
- Mock enumerates every `@discordjs/voice` symbol at `main.mjs:2089–2165`.
- Prod untouched unless `VERBALBENCH_INSTRUMENT=1` or `MOCK_DISCORD=1`.
- Row is HF Open Leaderboard superset.
