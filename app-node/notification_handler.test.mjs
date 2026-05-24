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
  let notifierCalls = 0;
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
