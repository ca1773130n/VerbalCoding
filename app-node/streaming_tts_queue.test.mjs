import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStreamingTTSQueue } from './streaming_tts_queue.mjs';

test('synths and plays in enqueue order', async () => {
  const order = [];
  const q = createStreamingTTSQueue({
    synth: async (t) => { order.push(`synth:${t}`); return `f-${t}`; },
    play: async (f) => { order.push(`play:${f}`); },
  });
  q.enqueue('A.');
  q.enqueue('B.');
  await q.drain();
  assert.deepEqual(order, ['synth:A.', 'play:f-A.', 'synth:B.', 'play:f-B.']);
});

test('abort stops further playback', async () => {
  const ctrl = new AbortController();
  const order = [];
  const q = createStreamingTTSQueue({
    synth: async (t) => `f-${t}`,
    play: async (f) => { order.push(`play:${f}`); if (f === 'f-A.') ctrl.abort(); },
    signal: ctrl.signal,
  });
  q.enqueue('A.');
  q.enqueue('B.');
  await q.drain();
  assert.deepEqual(order, ['play:f-A.']);
});

test('cleanup runs after play', async () => {
  const cleaned = [];
  const q = createStreamingTTSQueue({
    synth: async (t) => `f-${t}`,
    play: async () => {},
    cleanup: async (f) => { cleaned.push(f); },
  });
  q.enqueue('A.');
  await q.drain();
  assert.deepEqual(cleaned, ['f-A.']);
});

test('synth error skips that sentence but continues, and reports dropped count + onSynthError', async () => {
  const played = [];
  const errors = [];
  const q = createStreamingTTSQueue({
    synth: async (t) => { if (t === 'A.') throw new Error('boom'); return `f-${t}`; },
    play: async (f) => { played.push(f); },
    onSynthError: ev => errors.push(ev),
  });
  q.enqueue('A.');
  q.enqueue('B.');
  await q.drain();
  assert.deepEqual(played, ['f-B.']);
  assert.equal(q.droppedCount, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].text, 'A.');
  assert.match(errors[0].error.message, /boom/);
});

test('throws when synth or play missing', () => {
  assert.throws(() => createStreamingTTSQueue({ play: async () => {} }), /synth is required/);
  assert.throws(() => createStreamingTTSQueue({ synth: async () => {} }), /play is required/);
});
