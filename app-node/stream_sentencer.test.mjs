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

test('does not split on common abbreviations', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('Use e.g. main.mjs for the entry point. ');
  assert.deepEqual(out, ['Use e.g. main.mjs for the entry point.']);
});

test('treats decimals as one sentence', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('Version 3.14 is out. ');
  assert.deepEqual(out, ['Version 3.14 is out.']);
});

test('drops fenced code blocks from speech', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('Here is the change. ```js\nconst x = 1;\n``` Done.');
  s.flush();
  assert.deepEqual(out, ['Here is the change.', 'Done.']);
});

test('keeps fence state across pushes', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('Open fence. ```python\nimport os');
  s.push('\nprint(os.getcwd())\n``` Closed.');
  s.flush();
  assert.deepEqual(out, ['Open fence.', 'Closed.']);
});

test('terminates on Korean closing quote', () => {
  const out = [];
  const s = createSentencer({ minChars: 1, maxLatencyMs: 999999 });
  s.on('sentence', t => out.push(t));
  s.push('그가 말했다. "안녕." ');
  assert.deepEqual(out, ['그가 말했다.', '"안녕."']);
});
