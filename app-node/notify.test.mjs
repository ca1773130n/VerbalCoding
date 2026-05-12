import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier, buildDiscordDeepLink } from './notify.mjs';

test('ntfy provider posts to topic URL with title body and click headers', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const n = createNotifier({ provider: 'ntfy', topic: 'verbalcoding-test', fetchImpl });
  const res = await n.send({ title: 'Done', body: 'All green.', deepLink: 'discord://x' });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /ntfy\.sh\/verbalcoding-test/);
  assert.equal(calls[0].opts.headers.Title, 'Done');
  assert.equal(calls[0].opts.headers.Click, 'discord://x');
  assert.equal(calls[0].opts.body, 'All green.');
});

test('ntfy returns skipped when topic missing', async () => {
  const n = createNotifier({ provider: 'ntfy', fetchImpl: async () => ({ ok: true }) });
  const res = await n.send({ title: 't', body: 'b' });
  assert.equal(res.skipped, true);
});

test('shouldNotify true when zero humans and task long enough', () => {
  const n = createNotifier({ provider: 'noop' });
  assert.equal(n.shouldNotify({ humanCount: 0, taskMs: 10_000, minTaskMs: 1000 }), true);
  assert.equal(n.shouldNotify({ humanCount: 1, taskMs: 10_000, minTaskMs: 1000 }), false);
  assert.equal(n.shouldNotify({ humanCount: 0, taskMs: 100, minTaskMs: 1000 }), false);
  assert.equal(n.shouldNotify({ humanCount: 1, taskMs: 10_000, minTaskMs: 1000, userOptIn: true }), true);
});

test('redacts secret patterns from body', async () => {
  const calls = [];
  const fetchImpl = async (u, o) => { calls.push(o); return { ok: true }; };
  const n = createNotifier({ provider: 'ntfy', topic: 'x', fetchImpl });
  await n.send({ title: 't', body: 'token=abc123 finished. sk-fooBar12 also.', deepLink: '' });
  assert.match(calls[0].body, /\[REDACTED\]/);
  assert.doesNotMatch(calls[0].body, /sk-fooBar12/);
});

test('truncates long body to 200 chars', async () => {
  const calls = [];
  const fetchImpl = async (u, o) => { calls.push(o); return { ok: true }; };
  const n = createNotifier({ provider: 'ntfy', topic: 'x', fetchImpl });
  await n.send({ title: 't', body: 'x'.repeat(500) });
  assert.equal(calls[0].body.length, 200);
});

test('pushover posts json payload with url', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const n = createNotifier({ provider: 'pushover', pushoverUser: 'u', pushoverToken: 'tk', fetchImpl });
  await n.send({ title: 'Done', body: 'all good', deepLink: 'discord://x' });
  assert.match(calls[0].url, /pushover\.net/);
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.user, 'u');
  assert.equal(body.url, 'discord://x');
});

test('buildDiscordDeepLink composes web URL', () => {
  assert.equal(buildDiscordDeepLink({ guildId: '1', channelId: '2' }), 'https://discord.com/channels/1/2');
  assert.equal(buildDiscordDeepLink({}), '');
});

test('unknown provider throws', async () => {
  const n = createNotifier({ provider: 'unknown' });
  await assert.rejects(() => n.send({ title: 't', body: 'b' }), /unknown notify provider/);
});
