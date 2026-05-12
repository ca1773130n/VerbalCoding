# Phase 1 — Streaming End-to-End Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Stream the agent's stdout into the TTS pipeline so the first sentence plays seconds before the agent finishes the full reply.

**Architecture:** Today `agent_adapters.mjs::run` waits for the agent process to exit, then `tts_prefetch.mjs::playChunkedTTSWithPrefetch` consumes the final answer. New path: add `app-node/stream_sentencer.mjs` (a stateful sentence-boundary detector over a stdout stream), plumb it into the existing spawn-with-progress branch in `agent_adapters.mjs`, and feed sentences into a new `streaming_tts_queue.mjs` that synthesises and plays in order with abort support.

**Tech Stack:** Node 20 ESM, async stdout chunks, existing `splitForTTS`/`playChunkedTTSWithPrefetch`.

---

## Spec

### Stream sentencer

API:
```javascript
const sentencer = createSentencer({ minChars: 40, maxLatencyMs: 800 });
sentencer.on('sentence', s => ...);
sentencer.push(chunkText);
sentencer.flush();
```

Boundary rules:
- Terminal punctuation (`.!?。！？…`) followed by whitespace or EOS.
- Soft boundary on whitespace if buffer ≥ `minChars` and ≥ `maxLatencyMs` since last emit.
- Strip ANSI and Hermes box glyphs (`╭ ╰ │ ┊`) before emit.
- Drop `VERBALCODING_PROGRESS:` lines (those belong to the progress channel).

### Adapter changes

- `createAgentAdapter(settings, deps)` accepts `onSentence` callback in deps.
- Existing spawn-streaming branch (the one that already streams stdout for verbose mode) feeds the sentencer; final `flush()` runs on close.

### Bridge changes

- `main.mjs` builds a `StreamingTTSQueue` per turn when `STREAMING_TTS=1`.
- Queue: synth-on-arrival, play-in-order, drops further work when the existing barge-in signal aborts.
- When flag is off, behavior is unchanged.

---

## File Structure

- Create: `app-node/stream_sentencer.mjs`, `app-node/stream_sentencer.test.mjs`.
- Create: `app-node/streaming_tts_queue.mjs`, `app-node/streaming_tts_queue.test.mjs`.
- Modify: `app-node/agent_adapters.mjs` — plumb `onSentence` into the spawn-streaming branch.
- Modify: `app-node/main.mjs` — wire queue.
- Modify: `.env.example` — `STREAMING_TTS`.

---

## Tasks

### Task 1: Sentencer TDD

- [ ] Write `app-node/stream_sentencer.test.mjs` with five cases:
  1. Emits on terminal punctuation.
  2. Holds partial sentences until terminator.
  3. Strips ANSI before emitting.
  4. Filters `VERBALCODING_PROGRESS:` lines.
  5. `flush()` emits residual on close.

- [ ] Verify FAIL: `node --test app-node/stream_sentencer.test.mjs` → module missing.

### Task 2: Implement sentencer

- [ ] Create `app-node/stream_sentencer.mjs`:
  - `EventEmitter`-backed.
  - Internal `buffer` string.
  - On `push`: clean (regex strip ANSI + box chars + drop progress lines), append, scan for terminal punctuation, emit & advance index. If buffer ≥ minChars and elapsed ≥ maxLatencyMs, emit at last whitespace.
  - On `flush`: emit trimmed residual.

- [ ] Run tests: PASS.
- [ ] Commit: `feat(streaming): stream sentencer with ANSI/progress filtering`.

### Task 3: Streaming TTS queue TDD

- [ ] Write `app-node/streaming_tts_queue.test.mjs`:
  1. Synth + play happen in enqueue order.
  2. Abort signal stops further playback after current.

- [ ] Run, expect FAIL.

### Task 4: Implement queue

- [ ] Create `app-node/streaming_tts_queue.mjs`:
  - `createStreamingTTSQueue({ synth, play, signal, cleanup })`.
  - Internal FIFO; single async pump promise; honours `signal.aborted` between awaits; runs cleanup when aborted between synth and play.
- [ ] Run tests: PASS.
- [ ] Commit: `feat(streaming): TTS queue with abort support`.

### Task 5: Wire adapter

- [ ] In `agent_adapters.mjs`, accept `onSentence` from deps; build sentencer once per `run()`; feed both stdout and stderr; call `flush()` on close. Wrap existing `emitVerboseProgress` call site — sentences go to a different callback.
- [ ] Add adapter test using a fake spawn that emits stdout in three chunks; assert sentences arrive in order before the close handler fires.
- [ ] Commit.

### Task 6: Wire bridge

- [ ] In `main.mjs`, when `STREAMING_TTS=1`:
  - Build queue with the existing synth/play helpers.
  - Pass `onSentence: text => queue.enqueue(text)` to adapter.
  - After adapter returns, await `queue.drain()`; skip the post-run chunked playback path for already-streamed content.
- [ ] When flag is off, no change.
- [ ] Commit.

### Task 7: Document

- [ ] Add `STREAMING_TTS=1` to `.env.example` with a short comment.
- [ ] Add a "Streaming pipeline" subsection to `docs/CONFIGURATION.md`.
- [ ] Commit.

---

## Self-Review

- Spec covered.
- No placeholders.
- Names consistent: `createSentencer`, `createStreamingTTSQueue`, `onSentence`, `STREAMING_TTS`.
- Risk: TTS providers vary in latency; queue must not block enqueue on slow synth (single pump avoids this).
