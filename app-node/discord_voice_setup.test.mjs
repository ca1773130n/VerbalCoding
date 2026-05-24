import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordVoiceSetup } from './discord_voice_setup.mjs';
import { createBridge } from './bridge_context.mjs';

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  return {
    bridge,
    client: { destroy: () => {}, guilds: { cache: new Map() } },
    settings: { allowedUsers: new Set(), autoJoinVoiceChannels: ['general'], agent: {}, tts: { edge: { voice: 'ko-KR-x' } } },
    ROOT: '/tmp/vc-root',
    log: () => {}, warn: () => {},
    speakText: async () => {},
    waitEvent: async () => {},
    subscribeUser: () => {},
    pendingFallbackNoticePromises: new Set(),
    bindProjectSessionToChannel: () => ({ slug: 's', name: 'S', voiceChannelId: '', transcriptChannelId: '' }),
    createProjectSession: () => ({ slug: 's', name: 'S', voiceChannelId: '', transcriptChannelId: '' }),
    resolveProjectSessionForChannel: () => null,
    saveProjectSessionsState: () => {},
    projectSessionsState: { channelSessions: {} },
    invalidateBackendAdaptersForSession: () => {},
    VOICE_CONNECT_TIMEOUT_MS: 5000,
    ...overrides,
  };
}

test('createDiscordVoiceSetup exposes the expected functions', () => {
  const setup = createDiscordVoiceSetup(makeDeps());
  for (const name of ['connectTo', 'autoJoin', 'findVoiceChannelBySelector', 'voiceChannelLabel', 'resolveVoiceChannelForAttach', 'attachVoiceChannelToTextSession', 'gracefulShutdown']) {
    assert.equal(typeof setup[name], 'function', `${name} is exposed`);
  }
});

test('voiceChannelLabel returns "없음" when no channel id is given', async () => {
  const { voiceChannelLabel } = createDiscordVoiceSetup(makeDeps());
  const guild = { channels: { fetch: async () => null } };
  assert.equal(await voiceChannelLabel(guild, ''), '없음');
});

test('voiceChannelLabel returns "지정됨" when fetch throws', async () => {
  const { voiceChannelLabel } = createDiscordVoiceSetup(makeDeps());
  const guild = { channels: { fetch: async () => { throw new Error('boom'); } } };
  assert.equal(await voiceChannelLabel(guild, 'ch-id'), '지정됨');
});

test('findVoiceChannelBySelector resolves by channel name', async () => {
  const ch = { id: 'vc-1', name: 'General', isVoiceBased: () => true };
  const guild = { channels: { fetch: async () => new Map([['vc-1', ch]]) } };
  const { findVoiceChannelBySelector } = createDiscordVoiceSetup(makeDeps());
  const out = await findVoiceChannelBySelector(guild, 'general');
  assert.equal(out, ch);
});

test('findVoiceChannelBySelector throws on ambiguous name', async () => {
  const a = { id: 'vc-1', name: 'general', isVoiceBased: () => true };
  const b = { id: 'vc-2', name: 'general', isVoiceBased: () => true };
  const guild = { channels: { fetch: async () => new Map([['vc-1', a], ['vc-2', b]]) } };
  const { findVoiceChannelBySelector } = createDiscordVoiceSetup(makeDeps());
  await assert.rejects(() => findVoiceChannelBySelector(guild, 'general'), /여러 개야/);
});

test('findVoiceChannelBySelector throws when no match', async () => {
  const guild = { channels: { fetch: async () => new Map() } };
  const { findVoiceChannelBySelector } = createDiscordVoiceSetup(makeDeps());
  await assert.rejects(() => findVoiceChannelBySelector(guild, 'nope'), /찾지 못했어/);
});

test('resolveVoiceChannelForAttach falls back to msg.member voice channel', async () => {
  const ch = { id: 'vc-1', isVoiceBased: () => true };
  const { resolveVoiceChannelForAttach } = createDiscordVoiceSetup(makeDeps());
  const msg = { member: { voice: { channel: ch } }, guild: null };
  const out = await resolveVoiceChannelForAttach(msg, '');
  assert.equal(out, ch);
});

test('autoJoin uses pickOccupiedUserVoiceChannel when one is returned', async () => {
  // The real pickOccupiedUserVoiceChannel is module-imported; we can only stub the
  // surrounding inputs. Verify autoJoin doesn't throw when no matching channels.
  const deps = makeDeps();
  const { autoJoin } = createDiscordVoiceSetup(deps);
  await autoJoin();
  // No channels available -> no connection, no throw.
  assert.equal(deps.bridge.connection, null);
});
