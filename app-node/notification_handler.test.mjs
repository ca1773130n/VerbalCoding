import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationHandler } from './notification_handler.mjs';
import { createBridge } from './bridge_context.mjs';

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  const client = {
    channels: {
      fetch: async () => ({ members: new Map() }),
    },
  };
  return { bridge, client, log: () => {}, warn: () => {}, ...overrides };
}

test('createNotificationHandler exposes the expected functions', () => {
  const h = createNotificationHandler(makeDeps());
  for (const name of ['ensureNotifier', 'notifyStatusText', 'getVoiceChannelHumanCount', 'maybeNotifyTaskComplete']) {
    assert.equal(typeof h[name], 'function', `${name} is exposed`);
  }
});

test('ensureNotifier memoizes onto bridge.notifierInstance', () => {
  const deps = makeDeps();
  const { ensureNotifier } = createNotificationHandler(deps);
  const first = ensureNotifier();
  const second = ensureNotifier();
  assert.equal(first, second);
  assert.equal(deps.bridge.notifierInstance, first);
});

test('notifyStatusText reflects userOptIn and provider configuration', () => {
  const prev = { ...process.env };
  process.env.NOTIFY_PROVIDER = 'ntfy';
  process.env.NTFY_TOPIC = '';
  try {
    const deps = makeDeps();
    const { notifyStatusText } = createNotificationHandler(deps);
    let text = notifyStatusText();
    assert.match(text, /empty-channel only/);
    assert.match(text, /NOT configured/);
    deps.bridge.notifyUserOptIn = true;
    process.env.NTFY_TOPIC = 'topic-x';
    text = notifyStatusText();
    assert.match(text, /always/);
    assert.match(text, /\(configured\)/);
  } finally {
    Object.keys(process.env).forEach(k => { if (!(k in prev)) delete process.env[k]; });
    Object.assign(process.env, prev);
  }
});

test('getVoiceChannelHumanCount returns 0 when no active channel', async () => {
  const deps = makeDeps();
  const { getVoiceChannelHumanCount } = createNotificationHandler(deps);
  assert.equal(await getVoiceChannelHumanCount(), 0);
});

test('getVoiceChannelHumanCount excludes bots', async () => {
  const members = new Map([
    ['1', { user: { bot: false } }],
    ['2', { user: { bot: true } }],
    ['3', { user: { bot: false } }],
  ]);
  const deps = makeDeps({ client: { channels: { fetch: async () => ({ members }) } } });
  deps.bridge.activeVoiceChannelId = 'vc-1';
  const { getVoiceChannelHumanCount } = createNotificationHandler(deps);
  assert.equal(await getVoiceChannelHumanCount(), 2);
});

test('maybeNotifyTaskComplete returns early when provider is unset/noop', async () => {
  const prev = process.env.NOTIFY_PROVIDER;
  try {
    delete process.env.NOTIFY_PROVIDER;
    const deps = makeDeps();
    const { maybeNotifyTaskComplete } = createNotificationHandler(deps);
    await maybeNotifyTaskComplete({ answer: 'ok', label: 'agent', elapsedMs: 99999, guildId: 'g' });
    assert.equal(deps.bridge.notifierInstance, null, 'no notifier when provider unset');
    process.env.NOTIFY_PROVIDER = 'noop';
    await maybeNotifyTaskComplete({ answer: 'ok', label: 'agent', elapsedMs: 99999, guildId: 'g' });
    assert.equal(deps.bridge.notifierInstance, null, 'no notifier when provider noop');
  } finally {
    if (prev === undefined) delete process.env.NOTIFY_PROVIDER;
    else process.env.NOTIFY_PROVIDER = prev;
  }
});

// --- happy-path send + debounce + body construction ----------------------

test('maybeNotifyTaskComplete fires notifier.send with last sentence as body, deep link, and tracks lastNotify state', async () => {
  const prev = { ...process.env };
  const calls = [];
  process.env.NOTIFY_PROVIDER = 'ntfy';
  process.env.NTFY_TOPIC = 'topic-x';
  process.env.NOTIFY_MIN_TASK_MS = '0';      // pass the min-task gate
  process.env.NOTIFY_DEBOUNCE_MS = '5000';
  try {
    const deps = makeDeps();
    deps.bridge.notifyUserOptIn = true;        // bypass humanCount/empty-channel gate
    deps.bridge.activeVoiceChannelId = 'vc-1'; // for deepLink construction
    // Pre-seed a notifier so we don't depend on createNotifier internals.
    deps.bridge.notifierInstance = {
      shouldNotify: () => true,
      send: async payload => { calls.push(payload); return { ok: true, status: 200 }; },
    };
    const { maybeNotifyTaskComplete } = createNotificationHandler(deps);
    const answer = 'first sentence here. SECOND SENTENCE is the body.';
    await maybeNotifyTaskComplete({ answer, label: 'hermes', elapsedMs: 5000, guildId: 'g-1' });
    assert.equal(calls.length, 1, 'notifier.send called exactly once');
    assert.equal(calls[0].title, 'hermes finished');
    assert.equal(calls[0].body, 'SECOND SENTENCE is the body.', 'body = last sentence');
    assert.match(calls[0].deepLink, /g-1/, 'deep link includes guild id');
    assert.ok(deps.bridge.lastNotifyAt > 0, 'lastNotifyAt updated');
    assert.equal(deps.bridge.lastNotifyBody, 'SECOND SENTENCE is the body.');
  } finally {
    Object.keys(process.env).forEach(k => { if (!(k in prev)) delete process.env[k]; });
    Object.assign(process.env, prev);
  }
});

test('maybeNotifyTaskComplete debounces identical body within debounce window', async () => {
  const prev = { ...process.env };
  process.env.NOTIFY_PROVIDER = 'ntfy';
  process.env.NTFY_TOPIC = 'topic-x';
  process.env.NOTIFY_MIN_TASK_MS = '0';
  process.env.NOTIFY_DEBOUNCE_MS = '60000';
  try {
    let sendCalls = 0;
    const deps = makeDeps();
    deps.bridge.notifyUserOptIn = true;
    deps.bridge.notifierInstance = {
      shouldNotify: () => true,
      send: async () => { sendCalls++; return { ok: true }; },
    };
    const { maybeNotifyTaskComplete } = createNotificationHandler(deps);
    const answer = 'identical message';
    await maybeNotifyTaskComplete({ answer, label: 'a', elapsedMs: 5000, guildId: 'g' });
    await maybeNotifyTaskComplete({ answer, label: 'a', elapsedMs: 5000, guildId: 'g' });
    assert.equal(sendCalls, 1, 'second identical call is debounced');
  } finally {
    Object.keys(process.env).forEach(k => { if (!(k in prev)) delete process.env[k]; });
    Object.assign(process.env, prev);
  }
});

test('maybeNotifyTaskComplete respects shouldNotify=false (e.g. occupied channel, opt-out)', async () => {
  const prev = { ...process.env };
  process.env.NOTIFY_PROVIDER = 'ntfy';
  process.env.NOTIFY_MIN_TASK_MS = '0';
  try {
    let sendCalls = 0;
    const deps = makeDeps();
    deps.bridge.notifierInstance = {
      shouldNotify: () => false,
      send: async () => { sendCalls++; return { ok: true }; },
    };
    const { maybeNotifyTaskComplete } = createNotificationHandler(deps);
    await maybeNotifyTaskComplete({ answer: 'hi', label: 'x', elapsedMs: 9999, guildId: 'g' });
    assert.equal(sendCalls, 0, 'send not called when shouldNotify returns false');
    assert.equal(deps.bridge.lastNotifyAt, 0, 'lastNotifyAt untouched');
  } finally {
    Object.keys(process.env).forEach(k => { if (!(k in prev)) delete process.env[k]; });
    Object.assign(process.env, prev);
  }
});

test('maybeNotifyTaskComplete swallows notifier.send errors and warns', async () => {
  const prev = { ...process.env };
  process.env.NOTIFY_PROVIDER = 'ntfy';
  process.env.NOTIFY_MIN_TASK_MS = '0';
  try {
    const warnCalls = [];
    const deps = makeDeps({ warn: (...args) => warnCalls.push(args) });
    deps.bridge.notifyUserOptIn = true;
    deps.bridge.notifierInstance = {
      shouldNotify: () => true,
      send: async () => { throw new Error('network down'); },
    };
    const { maybeNotifyTaskComplete } = createNotificationHandler(deps);
    // Must not reject the calling code.
    await maybeNotifyTaskComplete({ answer: 'hi', label: 'x', elapsedMs: 9999, guildId: 'g' });
    assert.ok(warnCalls.some(args => /notify send failed/.test(args[0])), 'warn called with explanatory message');
  } finally {
    Object.keys(process.env).forEach(k => { if (!(k in prev)) delete process.env[k]; });
    Object.assign(process.env, prev);
  }
});
