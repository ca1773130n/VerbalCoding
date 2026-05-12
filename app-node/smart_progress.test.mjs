import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSmartProgressSummarizer } from './smart_progress.mjs';

test('falls back to raw events when no apiKey', async () => {
  const out = [];
  const s = createSmartProgressSummarizer({ windowMs: 10 });
  s.on('summary', t => out.push(t));
  s.ingest('reading files routes.ts');
  s.ingest('editing files routes.ts');
  await new Promise(r => setTimeout(r, 40));
  assert.ok(out.includes('reading files routes.ts'));
  assert.ok(out.includes('editing files routes.ts'));
});

test('calls fetch with correct headers and body when apiKey is set', async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { json: async () => ({ choices: [{ message: { content: 'Wiring the new login endpoint.' } }] }) };
  };
  const out = [];
  const s = createSmartProgressSummarizer({
    apiKey: 'k',
    fetchImpl: fakeFetch,
    windowMs: 10,
    timeoutMs: 200,
  });
  s.on('summary', t => out.push(t));
  s.ingest('reading auth.ts');
  s.ingest('editing routes.ts');
  await new Promise(r => setTimeout(r, 80));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /chat\/completions$/);
  assert.equal(calls[0].opts.headers.authorization, 'Bearer k');
  assert.deepEqual(out, ['Wiring the new login endpoint.']);
});

test('timeout falls back to raw events', async () => {
  const slowFetch = () => new Promise(() => {});
  const out = [];
  const s = createSmartProgressSummarizer({
    apiKey: 'k',
    fetchImpl: slowFetch,
    windowMs: 10,
    timeoutMs: 30,
  });
  s.on('summary', t => out.push(t));
  s.ingest('reading auth.ts');
  s.ingest('editing routes.ts');
  await new Promise(r => setTimeout(r, 120));
  assert.ok(out.length >= 2);
  assert.ok(out.includes('reading auth.ts'));
});

test('maxBatch triggers immediate flush', async () => {
  const out = [];
  const s = createSmartProgressSummarizer({ windowMs: 999999, maxBatch: 3 });
  s.on('summary', t => out.push(t));
  s.ingest('a');
  s.ingest('b');
  assert.equal(out.length, 0);
  s.ingest('c');
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(out, ['a', 'b', 'c']);
});
