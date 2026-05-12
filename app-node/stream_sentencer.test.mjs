import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSentencer } from './stream_sentencer.mjs';

test('emits a sentence on terminal punctuation', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('Hello world. ');
  assert.deepEqual(out, ['Hello world.']);
});

test('does not emit on partial sentence', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('Reading file');
  assert.deepEqual(out, []);
  s.push(' main.mjs.');
  assert.deepEqual(out, ['Reading file main.mjs.']);
});

test('strips ANSI before emitting', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('\x1b[32mDone.\x1b[0m ');
  assert.deepEqual(out, ['Done.']);
});

test('filters VERBALCODING_PROGRESS lines', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('VERBALCODING_PROGRESS: reading files main.mjs\nAll set.');
  s.flush();
  assert.deepEqual(out, ['All set.']);
});

test('flush emits residual on close', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('No terminator here');
  s.flush();
  assert.deepEqual(out, ['No terminator here']);
});

test('strips Hermes box characters', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('│ Done.');
  s.flush();
  assert.deepEqual(out, ['Done.']);
});

test('emits multiple sentences in one push', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('First. Second. Third.');
  assert.deepEqual(out, ['First.', 'Second.', 'Third.']);
});
