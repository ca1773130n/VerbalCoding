import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge } from './bridge_context.mjs';

test('createBridge returns independent state per call', () => {
  const a = createBridge();
  const b = createBridge();
  a.speaking = true;
  a.activeStreams.set('user-1', { foo: 1 });
  a.planStates.set('chan', { steps: [] });
  assert.equal(b.speaking, false);
  assert.equal(b.activeStreams.size, 0);
  assert.equal(b.planStates.size, 0);
});

test('createBridge seeds the expected containers and primitives', () => {
  const b = createBridge();
  // Containers
  for (const key of [
    'activeStreams', 'interruptedTurns', 'recentDiscordTextByChannel',
    'planStates', 'agentAdaptersBySession', 'agentAdaptersByBackend',
    'routingStateByChannel', 'ontologyByChannel', 'installedBinaryCache',
  ]) {
    assert.ok(b[key] instanceof Map || b[key] instanceof Set, `${key} is a container`);
    assert.equal(b[key].size, 0, `${key} starts empty`);
  }
  // Primitive defaults
  assert.equal(b.connection, null);
  assert.equal(b.player, null);
  assert.equal(b.ttsBackend, null);
  assert.equal(b.bridgeState, null);
  assert.equal(b.speaking, false);
  assert.equal(b.processing, false);
  assert.equal(b.activeTurnId, 0);
  assert.equal(b.activeVoiceChannelId, '');
  assert.equal(b.activeTranscriptChannelId, '');
  assert.equal(b.speechPlaybackGeneration, 0);
  assert.equal(b.notifyUserOptIn, false);
  assert.equal(b.streamingSpeechDelivered, false);
  assert.equal(b.sensitivityMode, 'normal');
  assert.ok(b.verboseProgressSpeechQueue instanceof Promise);
  assert.deepEqual(b.progressSpeechBatch, []);
});

test('mutations on one bridge do not leak to another', () => {
  const a = createBridge();
  const b = createBridge();
  a.routingStateByChannel.set('c1', { backend: 'codex' });
  a.processing = true;
  a.activeTurnId = 7;
  assert.equal(b.routingStateByChannel.size, 0);
  assert.equal(b.processing, false);
  assert.equal(b.activeTurnId, 0);
});
