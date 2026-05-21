# Phase 12 — Per-Speaker Multi-User Voice State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scope routing, plan-mode, recent-utterance buffer, and ontology projection to `(channelId, userId)` so two humans in one Discord voice channel get independent agent state, while keeping a shared channel-level ontology layer and serializing agent invocations (TTS audio remains a single broadcast stream).

**Architecture:** Extend the channel-key helpers in `app-node/main.mjs` with a `For(userId)` variant; rekey `routingStateByChannel`, `planStates`, and `ontologyByChannel` to `<channelId>:<userId>` with channel-only fallback for unattributed paths and default-agent reads. Add a per-channel agent-invocation queue (FIFO with brief inter-speaker narration) layered on top of the existing `bridgeState` deferred queue. Ontology becomes a two-tier read: per-speaker overlay merged onto a channel-shared base. Audio output stays unicast-to-channel — only **state** is per-user.

**Tech Stack:** Node 20 ESM, existing `bridgeState` (`createBridgeState`), `createSessionOntology`, `node --test`.

---

## Spec

### Key shape

- New helper `speakerKey(channelId, userId)` → `"<channelId>:<userId>"`. Channel-only key (`"<channelId>"`) remains valid as the fallback / shared layer.
- `planChannelKeyFor(userId)` companion to `planChannelKey()` at `app-node/main.mjs:399`. `planChannelKey()` retained for non-turn paths (default-agent reads, channel-wide resets, push notifications, voice-clone capture).
- `routingStateFor(key)` (`main.mjs:639`) accepts either key shape; on miss for `"chan:user"` it **copies** from `"chan"` once (so first-time user inherits channel default), then diverges.

### Plan mode

- `planStates` (`main.mjs:397`) rekeyed to `speakerKey`. `dispatchPlanModeUtterance(prompt, signal)` (`main.mjs:422`) takes a `userId` arg and uses `planChannelKeyFor(userId)`. Concurrent plan sessions per user are independent; `"cancel"` / `"approve"` only affect the speaker's plan.

### Ontology projection

- `ontologyByChannel` (`main.mjs:663`) becomes two stores per channel: `baseOntology(channelKey)` (shared) + `speakerOntology(channelKey, userId)` (overlay).
- New `ontologyProjectionFor(channelKey, userId)` returns a read-through view: search/serialize merges base first, overlay second (overlay supersedes on slot collision).
- `captureOntologyFromTurn` (`main.mjs:675`) writes to overlay; a low-frequency promoter (every N turns or on `!session save`) lifts overlay nodes whose `by` set spans ≥2 users into base. Promotion is pure; unit-testable.
- Persisted file layout: `.verbalcoding/ontology/<channel>.json` (base) and `.verbalcoding/ontology/<channel>/<user>.json` (overlay). `createSessionOntology` already takes `channelKey`; reuse with a composite key for overlay.

### Turn taking

- New module `app-node/turn_queue.mjs`: per-channel FIFO of `{ userId, runFn, enqueuedAt }`. Drains serially; emits `onWaiting(userId, aheadOf)` when a second speaker arrives mid-run.
- `handleRecording(userId, ...)` (`main.mjs:1756`) submits work via the queue rather than calling the adapter directly. Existing `bridgeState.enqueueDeferred` path (`main.mjs:1647`) remains for per-user segment accumulation; the queue layers above it.
- When `onWaiting` fires and channel has ≥2 distinct waiting users, speak one short notice: e.g. `"User B, queued after User A."` Throttled to once per consecutive wait.
- `clearTransientRouting(planChannelKey())` (`main.mjs:2064`) is rewritten to `clearTransientRouting(planChannelKeyFor(userId))` so a barge-in by User A does not nuke User B's sticky route.

### Audio (explicit non-goal)

- TTS remains a single shared stream per `VoiceConnection`. No per-user audio routing. Document this in `docs/USAGE.md` so users know responses are heard by everyone.

---

## File Structure

- Create: `app-node/turn_queue.mjs` — per-channel serial FIFO with `enqueue`, `length`, `onWaiting`.
- Create: `app-node/turn_queue.test.mjs` — serializes overlapping submissions; emits waiting notice once.
- Create: `app-node/speaker_key.mjs` — `speakerKey`, `planChannelKeyFor`, `splitSpeakerKey`.
- Create: `app-node/speaker_key.test.mjs`.
- Create: `app-node/ontology_projection.mjs` — `ontologyProjectionFor`, `promoteCrossUserNodes`.
- Create: `app-node/ontology_projection.test.mjs` — overlay supersedes base; promotion threshold; isolation between users.
- Modify: `app-node/main.mjs` — rekey `routingStateByChannel` (`:640`), `planStates` (`:397`), `ontologyByChannel` (`:663`); add `planChannelKeyFor`; thread `userId` through `dispatchPlanModeUtterance` (`:422`), `captureOntologyFromTurn` (`:675`), `clearTransientRouting` (`:2064`), and the final-block cleanup in `handleRecording` (`:1756`). Wire `turn_queue` around the adapter call inside `handleRecording`.
- Modify: `app-node/session_ontology.mjs` — accept composite `channelKey` (`/Users/neo/Developer/Projects/VerbalCoding/app-node/session_ontology.mjs:35`) without sanitizing `:` out of the path; verify `safeChannelKey` allows the separator.
- Modify: `app-node/plan_mode.test.mjs` — add two-user concurrent plan-mode case.
- Modify: `docs/USAGE.md` — add "Multi-user voice channels" section; note shared audio, per-user state.
- Modify: `docs/CONFIGURATION.md` — document `MULTI_USER_TURN_NOTICE=on|off`, `MULTI_USER_TURN_NOTICE_THROTTLE_MS` (default 8000).

---

## Tasks

### Task 1: Failing test for `speakerKey` + `planChannelKeyFor`

**Files:** Create `app-node/speaker_key.test.mjs`.

- [ ] Step 1: Write failing test.

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakerKey, planChannelKeyFor, splitSpeakerKey } from './speaker_key.mjs';

test('speakerKey composes channel and user', () => {
  assert.equal(speakerKey('chan1', 'user9'), 'chan1:user9');
});
test('planChannelKeyFor falls back when channel missing', () => {
  assert.equal(planChannelKeyFor(null, 'u1'), 'default:u1');
});
test('splitSpeakerKey round-trips and tolerates channel-only', () => {
  assert.deepEqual(splitSpeakerKey('chan1:user9'), { channelId: 'chan1', userId: 'user9' });
  assert.deepEqual(splitSpeakerKey('chan1'), { channelId: 'chan1', userId: null });
});
```

- [ ] Step 2: `node --test app-node/speaker_key.test.mjs` → FAIL (module missing).

### Task 2: Implement `speaker_key.mjs` + green test

- [ ] Step 1: Implement; `planChannelKeyFor(channelId, userId)` mirrors `planChannelKey()` (`main.mjs:399`) plus `:userId` suffix.
- [ ] Step 2: Run test → PASS.
- [ ] Step 3: Commit: `feat(multi-user): per-(channel,user) key helpers`.

### Task 3: Failing test for `turn_queue`

- [ ] Step 1: Test (a) serializes two overlapping `enqueue` calls (second runFn starts only after first resolves); (b) `onWaiting` fires exactly once per distinct waiting userId across consecutive waits within throttle window.
- [ ] Step 2: Run → FAIL.

### Task 4: Implement `turn_queue.mjs` + green test

- [ ] Step 1: FIFO per `channelId`. `enqueue({channelId, userId, runFn})` returns a Promise resolving to runFn's result. Internal state: `Map<channelId, { running, queue, lastNoticeAt, lastNoticeUserId }>`.
- [ ] Step 2: Run → PASS. Commit: `feat(multi-user): per-channel serial turn queue with waiting notice`.

### Task 5: Failing test for ontology projection

- [ ] Step 1: Two users in same channel write distinct nodes; `ontologyProjectionFor(chan, userA).serialize()` contains A's nodes + shared base, not B's. `promoteCrossUserNodes(...)` lifts nodes whose `by` covers ≥2 distinct users.
- [ ] Step 2: Run → FAIL.

### Task 6: Implement `ontology_projection.mjs` + green test

- [ ] Step 1: Wrap two `createSessionOntology` instances (base + overlay). Implement merged read; promotion checks node-level `by` set.
- [ ] Step 2: Run → PASS. Commit: `feat(multi-user): two-tier ontology projection (shared base + per-user overlay)`.

### Task 7: Rekey state maps in `main.mjs`

**Files:** `app-node/main.mjs`.

- [ ] Step 1: Import `speakerKey`, `planChannelKeyFor` from `./speaker_key.mjs`.
- [ ] Step 2: Update `routingStateFor` (`:639`) — first-time `chan:user` lookup clones from `chan` if present (inheritance), then stored independently. Keep channel-only `routingStateFor(chan)` working for status commands.
- [ ] Step 3: Thread `userId` through `dispatchPlanModeUtterance` (`:422`), `recordUtterance` (`:656`), `captureOntologyFromTurn` (`:675`), `resetRoutingState` (`:686`), `clearTransientRouting` (`:2064`). Call sites in `handleRecording` (`:1756`) and the plan-mode dispatcher pass `userId`.
- [ ] Step 4: Keep one channel-level call site: the `voiceCloneCapture` flow at `main.mjs:1535` reads channel-level state (no rekey needed). Document with a comment.
- [ ] Step 5: Run full suite: `node --test app-node`. Expected PASS; any new flake means missing `userId` propagation.
- [ ] Step 6: Commit: `feat(multi-user): scope routing/plan/ontology to (channel,user)`.

### Task 8: Wire `turn_queue` into `handleRecording`

- [ ] Step 1: Inside `handleRecording` (`main.mjs:1756`), wrap the adapter dispatch in `turnQueue.enqueue({ channelId: activeVoiceChannelId, userId, runFn: () => actualWork() })`.
- [ ] Step 2: On `onWaiting`, gated by `MULTI_USER_TURN_NOTICE !== 'off'`, call `speakText(noticeFor(userId, language), null, null)`. Notice strings live in a small map; localized for `en`/`ko`.
- [ ] Step 3: Existing `bridgeState.deferredSize` drain (`main.mjs:2083`) keeps working — it operates per-user upstream of the queue.
- [ ] Step 4: Add `app-node/multi_user_turn.test.mjs`: two simulated `handleRecording` calls overlap; verify they run sequentially and a single notice TTS is emitted.
- [ ] Step 5: Run, commit: `feat(multi-user): serialize per-channel agent turns with waiting notice`.

### Task 9: Docs

- [ ] Step 1: `docs/USAGE.md` — add **Multi-user voice channels** section: per-user routing/plan/ontology, **shared TTS audio**, turn-taking notice.
- [ ] Step 2: `docs/CONFIGURATION.md` — `MULTI_USER_TURN_NOTICE`, `MULTI_USER_TURN_NOTICE_THROTTLE_MS`.
- [ ] Step 3: Update `docs/HARNESS_*` "Shared semantics" bullet to read "per (channel, user) routing and plan-mode".
- [ ] Step 4: Commit: `docs(multi-user): document per-speaker state and shared audio`.

---

## Self-Review

- Spec coverage: per-user routing ✓ (`:640`), per-user plan ✓ (`:397`), two-tier ontology ✓ (`:663`), turn queue ✓ (new), shared-audio caveat documented ✓.
- No placeholders. Composite keys backward-compatible via channel-only fallback in `routingStateFor`.
- Tests precede code in every task. `node --test app-node` is the only runner; no new deps.
- Cross-cutting risk: `safeChannelKey` in `session_ontology.mjs:35` must permit `:` — Task 6 explicitly verifies.
