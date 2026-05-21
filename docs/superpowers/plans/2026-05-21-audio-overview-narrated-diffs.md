# Audio Overview — Two-Voice Narrated Diffs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace the "diff too long to read aloud" dead-end (`app-node/main.mjs:1033-1037`) with a NotebookLM-style two-voice audio overview: a 30–60 s scripted Host A / Host B dialogue summarizing long agent outputs (diffs, test logs, listings) instead of skipping them.

**Architecture:** New `audio_overview.mjs` sits between `spokenResultOnly` (`app-node/main.mjs:1031`) and the streaming TTS queue. On trigger it (a) asks the active cheap-LLM adapter to script `[A]/[B]` dialogue, (b) feeds the script to the sentencer (`app-node/stream_sentencer.mjs:18`) which now also splits on speaker markers, (c) the queue (`app-node/streaming_tts_queue.mjs:1`) calls `synth(text, { voice })` with `AUDIO_OVERVIEW_VOICE_A` / `_B`. Any failure falls back to the existing notice.

**Tech Stack:** Node 20 ESM, active adapter (`adapterForBackend` at `app-node/main.mjs:730`) for scripting, Edge TTS multi-voice (`createEdgeTtsBackend` at `app-node/tts_backends.mjs:206`) — `voiceProvider` becomes per-call.

---

## Spec

### API

```javascript
const overview = createAudioOverview({
  thresholdChars: Number(env.AUDIO_OVERVIEW_THRESHOLD || 1500),
  voiceA: env.AUDIO_OVERVIEW_VOICE_A || 'en-US-GuyNeural',
  voiceB: env.AUDIO_OVERVIEW_VOICE_B || 'en-US-JennyNeural',
  scriptModel: () => adapterForBackend(routingStateFor(key).activeRouting?.backend),
  language: settings.voiceLanguage,
  timeoutMs: 4000,
});
const result = await overview.maybeScript({ userPrompt, answer });
// result: { kind: 'overview', segments: [{ voice, text }, ...] } | { kind: 'skip' }
```

### Behavior

- **Trigger** (`shouldNarrate`): `answer.length > thresholdChars` OR `isPatchLikeOutput(answer)` already at `app-node/main.mjs:1033`. Re-export helper.
- **Script prompt** (fixed system): _"Script a 30–60 s podcast summary of this coding agent answer. Output 4–6 turns alternating `[A]` (asks) / `[B]` (explains). No markdown, no fences, no paths unless essential. Language: {language}."_ User = first 2 KB of `stripMarkdownNoise(answer)`.
- **Cache** identical answers 10 min (Map keyed by sha1). **Timeout** 4 s. **Disabled** when `AUDIO_OVERVIEW=0` or toggled off in routing state.

### Integration

- `stream_sentencer.mjs`: add `speakerMarkers: ['[A]', '[B]']` option to `createSentencer` (`app-node/stream_sentencer.mjs:18`). When set, `ingest()` splits on each marker; `'sentence'` event payload becomes `{ text, voice }`.
- `streaming_tts_queue.mjs:40`: `enqueue(text, opts)` stores `{ text, voice }` in the queue (`app-node/streaming_tts_queue.mjs:5`); pump (`app-node/streaming_tts_queue.mjs:11`) passes `voice` to `synth(text, { voice })`.
- `tts_backends.mjs`: `synthesize(text, { signal, voice })` in `createEdgeTtsBackend` (`app-node/tts_backends.mjs:225`) overrides `currentVoice()` when `voice` is set. Other backends keep default voice (logged once).
- `main.mjs`: in `spokenResultOnly` (`app-node/main.mjs:1031-1051`), before the "diff too long" return, call `overview.maybeScript()`; on `'overview'` push `segments` through the streaming path; `synth` closure (`app-node/main.mjs:1320`) upgraded to `synth(text, { voice })`.
- **User control**: at the `voiceCommandFromTranscript` callsite (`app-node/main.mjs:984`) parse `"audio overview off|on"` / `"오디오 오버뷰 꺼|켜"` and toggle `routingStateFor(key).audioOverviewEnabled` (default `true`).

---

## File Structure

- Create: `app-node/audio_overview.mjs`, `app-node/audio_overview.test.mjs`.
- Modify: `app-node/stream_sentencer.mjs` — speaker-marker split.
- Modify: `app-node/streaming_tts_queue.mjs` — per-chunk voice passthrough.
- Modify: `app-node/tts_backends.mjs` — `voice` override in `createEdgeTtsBackend`.
- Modify: `app-node/main.mjs` — wire trigger, voice command, routing flag.
- Modify: `.env.example` — `AUDIO_OVERVIEW`, `AUDIO_OVERVIEW_THRESHOLD`, `AUDIO_OVERVIEW_VOICE_A`, `AUDIO_OVERVIEW_VOICE_B`.

---

## Tasks

### Task 1: TDD — trigger + parser

- [ ] Step 1: `audio_overview.test.mjs`: short answer → `{ kind: 'skip' }`; long answer or `isPatchLikeOutput` short diff → `maybeScript` invoked.
- [ ] Step 2: Mock adapter returns `"[A] What changed?\n[B] Two files in router."`; expect `segments[0].voice === voiceA`. Malformed output (no `[A]/[B]`) → `{ kind: 'skip' }`.

### Task 2: Implement `audio_overview.mjs`

- [ ] Step 1: `createAudioOverview({...})` returning `{ maybeScript }`. Cache `Map<sha1, segments>` 10 min TTL.
- [ ] Step 2: Script call via injected `scriptModel()` (`.ask(system, user, { signal, timeoutMs })`); strip fences + markdown per segment.
- [ ] Step 3: Run, expect PASS, commit.

### Task 3: Extend `stream_sentencer.mjs`

- [ ] Step 1: Add `speakerMarkers` to `createSentencer` (`app-node/stream_sentencer.mjs:18`). Emit `{ text, voice }`; keep back-compat with `{ text, voice: null }` when option absent.
- [ ] Step 2: Update listener at `app-node/main.mjs:1333` for the object form.
- [ ] Step 3: Add `stream_sentencer.test.mjs` covering marker split + fence preservation.

### Task 4: Extend `streaming_tts_queue.mjs`

- [ ] Step 1: `enqueue(text, { voice } = {})`; queue stores objects; pump calls `synth(text, { voice })`.
- [ ] Step 2: Test: two enqueues with distinct voices both reach mock synth with matching arg.

### Task 5: Extend `createEdgeTtsBackend`

- [ ] Step 1: `synthesize` at `app-node/tts_backends.mjs:225` accepts `voice` and substitutes into `-v` argv.
- [ ] Step 2: Non-edge backends log "audio overview voice swap unsupported on {backend}" once.

### Task 6: Wire into `main.mjs`

- [ ] Step 1: Instantiate `audioOverview` after `createTtsBackend` (`app-node/main.mjs:253`).
- [ ] Step 2: In `spokenResultOnly` (`app-node/main.mjs:1031`), when trigger fires and `routingStateFor(key).audioOverviewEnabled !== false`, `await overview.maybeScript(...)`; on `'overview'` enqueue segments; on `'skip'` keep existing notice.
- [ ] Step 3: Parse `"audio overview on|off"` / Korean in the `handleTtsVoiceCommand` chain (`app-node/main.mjs:983`). Routing state only — no env write.

### Task 7: Document

- [ ] Step 1: `.env.example` adds four keys after `STREAMING_TTS` (line 26).
- [ ] Step 2: Note the two-voice fallback rule in `docs/superpowers/` README. Commit.
