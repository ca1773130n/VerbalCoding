import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentTurnLifecycle } from './agent_turn.mjs';
import { createBridge } from './bridge_context.mjs';

const noop = () => {};

function makeLifecycle(overrides = {}) {
  const bridge = createBridge();
  const lifecycle = createAgentTurnLifecycle({
    bridge,
    warn: noop,
    ...overrides,
  });
  return { bridge, lifecycle };
}

test('start sets up controllers, progress signals, and processing flag', () => {
  const { bridge, lifecycle } = makeLifecycle();
  bridge.activeTranscriptChannelId = 'prev-ch';
  const turn = lifecycle.start();
  assert.ok(turn.controller instanceof AbortController);
  assert.ok(turn.progressController instanceof AbortController);
  assert.equal(turn.signal, turn.controller.signal);
  assert.equal(turn.previousTranscriptChannelId, 'prev-ch');
  assert.equal(turn.turnId, undefined, 'no turnId without withTurnId opt');
  assert.equal(bridge.processing, true);
  assert.equal(bridge.currentAbortController, turn.controller);
  assert.equal(bridge.activeProgressAbortController, turn.progressController);
  assert.equal(bridge.activeProgressSignal, turn.progressController.signal);
  assert.ok(bridge.activeProgressLastEventAt > 0);
});

test('start with withTurnId allocates and exposes a turnId', () => {
  const { bridge, lifecycle } = makeLifecycle();
  const turn = lifecycle.start({ withTurnId: true });
  assert.equal(typeof turn.turnId, 'number');
  assert.equal(bridge.activeTurnId, turn.turnId);
  const turn2 = lifecycle.start({ withTurnId: true });
  assert.equal(turn2.turnId, turn.turnId + 1, 'turn ids monotonically increment');
});

test('finish clears all controllers + flags and restores transcript channel', () => {
  const { bridge, lifecycle } = makeLifecycle();
  bridge.activeTranscriptChannelId = 'prev-ch';
  const turn = lifecycle.start();
  bridge.activeTranscriptChannelId = 'turn-ch';        // simulate mutation during work
  lifecycle.finish(turn);
  assert.equal(bridge.processing, false);
  assert.equal(bridge.currentAbortController, null);
  assert.equal(bridge.activeProgressAbortController, null);
  assert.equal(bridge.activeProgressSignal, null);
  assert.equal(bridge.activeTranscriptChannelId, 'prev-ch', 'restored');
  assert.equal(turn.progressController.signal.aborted, true);
});

test('finish does NOT touch the progress-speech batch (caller responsibility)', () => {
  // Pre-refactor the voice path did not call clearProgressSpeechBatch; the
  // text path did. The lifecycle stays path-agnostic — callers that need
  // the batch cleared do it explicitly before finish().
  const { bridge, lifecycle } = makeLifecycle();
  bridge.progressSpeechBatch = ['queued event'];
  bridge.progressSpeechBatchSignal = 'some-sig';
  const turn = lifecycle.start();
  lifecycle.finish(turn);
  // Batch state preserved — caller decides when to drop it.
  assert.deepEqual(bridge.progressSpeechBatch, ['queued event']);
  assert.equal(bridge.progressSpeechBatchSignal, 'some-sig');
});

test('finish does NOT abort a newer turn that overrode the active progress controller', () => {
  // This was the race Codex flagged on the voice path. We start turn A,
  // then while A is still "in flight" we start turn B (simulating a
  // re-entrant call); A's finish() must not abort B's progress controller.
  const { bridge, lifecycle } = makeLifecycle();
  const turnA = lifecycle.start();
  // Turn B takes over (this WOULDN'T happen in practice because the
  // processing guard prevents re-entry, but the cleanup must still be
  // defensive against any path that leaves a stale controller in place).
  const turnB = lifecycle.start();
  // Now finish A. Its progressController was overridden by B; A's finish
  // must leave B's controller alone.
  lifecycle.finish(turnA);
  assert.equal(bridge.activeProgressAbortController, turnB.progressController, 'B\'s progress controller untouched');
  assert.equal(turnB.progressController.signal.aborted, false, 'B not aborted by A\'s cleanup');
  // But A's own progressController did get aborted (it's still A's; it just wasn't bridge.active anymore).
  // The contract is "only abort if it's the active one." A's controller is no longer active so it stays unaborted.
  assert.equal(turnA.progressController.signal.aborted, false);
});

test('finish with withTurnId clears interruptedTurns and resets activeTurnId only when it matches', () => {
  const { bridge, lifecycle } = makeLifecycle();
  const turnA = lifecycle.start({ withTurnId: true });
  bridge.interruptedTurns.add(turnA.turnId);
  // Simulate a newer turn taking activeTurnId.
  const turnB = lifecycle.start({ withTurnId: true });
  lifecycle.finish(turnA);
  assert.ok(!bridge.interruptedTurns.has(turnA.turnId), 'A removed from interruptedTurns');
  assert.equal(bridge.activeTurnId, turnB.turnId, 'activeTurnId left as B\'s id (only resets when matching)');
});

test('finish is a no-op when passed null/undefined', () => {
  const { bridge, lifecycle } = makeLifecycle();
  bridge.processing = true;
  lifecycle.finish(null);
  lifecycle.finish(undefined);
  // processing is unchanged because we ignored both calls
  assert.equal(bridge.processing, true);
});
