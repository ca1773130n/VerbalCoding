import assert from 'node:assert/strict';
import test from 'node:test';

import { createBridgeState } from './bridge_state.mjs';

test('bridge state discards pending and deferred utterances on epoch change', () => {
  const cleaned = [];
  const logs = [];
  const state = createBridgeState({ cleanupFile: file => cleaned.push(file), log: (...args) => logs.push(args.join(' ')) });

  state.appendSegment('user', {
    file: '/tmp/one.wav',
    pcmBytes: 10,
    startedAtMs: 1,
    endedAtMs: 2,
    timerFactory: () => setTimeout(() => {}, 10000),
  });
  state.enqueueDeferred({ userId: 'user', wavPath: '/tmp/deferred.wav' }, (queue, item) => {
    queue.push(item);
    return { queued: true };
  }, 10);

  const nextEpoch = state.discardQueues('language-change');

  assert.equal(nextEpoch, 1);
  assert.deepEqual(cleaned.sort(), ['/tmp/deferred.wav', '/tmp/one.wav'].sort());
  assert.equal(state.getPending('user'), undefined);
  assert.equal(state.deferredSize(), 0);
  assert.match(logs.join('\n'), /language-change/);
});

test('bridge state drops stale pending segment after config change', () => {
  const cleaned = [];
  const state = createBridgeState({ cleanupFile: file => cleaned.push(file) });

  state.appendSegment('user', { file: '/tmp/old.wav', pcmBytes: 10, startedAtMs: 1, endedAtMs: 2 });
  state.discardQueues('voice-change');
  const pending = state.appendSegment('user', { file: '/tmp/new.wav', pcmBytes: 20, startedAtMs: 3, endedAtMs: 4 });

  assert.equal(pending.epoch, state.currentEpoch());
  assert.deepEqual(pending.files, ['/tmp/new.wav']);
  assert.equal(pending.pcmBytes, 20);
  assert.ok(cleaned.includes('/tmp/old.wav'));
});

test('bridge state skips stale deferred utterances', () => {
  const cleaned = [];
  const state = createBridgeState({ cleanupFile: file => cleaned.push(file) });

  state.enqueueDeferred({ userId: 'user', wavPath: '/tmp/stale.wav' }, (queue, item) => {
    queue.push(item);
    return { queued: true };
  }, 10);
  state.discardQueues('language-change');
  state.enqueueDeferred({ userId: 'user', wavPath: '/tmp/current.wav' }, (queue, item) => {
    queue.push(item);
    return { queued: true };
  }, 10);

  const next = state.shiftDeferred();
  assert.equal(next.wavPath, '/tmp/current.wav');
  assert.equal(state.shiftDeferred(), null);
  assert.ok(cleaned.includes('/tmp/stale.wav'));
});
