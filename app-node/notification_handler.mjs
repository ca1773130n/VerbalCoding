// Runtime notification dispatcher built on top of `./notify.mjs`'s createNotifier.
//
// Phase 5b extraction from main.mjs. Closes over bridge state
// (notifierInstance, notifyUserOptIn, lastNotifyAt, lastNotifyBody,
// activeVoiceChannelId) plus the Discord client for human-count lookups.
//
// `ttsFallbackNotice` stays in main.mjs: it's wired through createTtsBackend's
// onFallback callback at module init (before ttsPlayer / sendText / speakText
// are fully bound), and threading it through a factory would require thunk
// indirection for marginal gain.

import { createNotifier, buildDiscordDeepLink } from './notify.mjs';

export function createNotificationHandler(deps) {
  const {
    bridge,
    client,
    log,
    warn,
  } = deps;

  function ensureNotifier() {
    if (bridge.notifierInstance) return bridge.notifierInstance;
    bridge.notifierInstance = createNotifier({
      provider: (process.env.NOTIFY_PROVIDER || 'ntfy').toLowerCase(),
      topic: process.env.NTFY_TOPIC || '',
      pushoverUser: process.env.PUSHOVER_USER || '',
      pushoverToken: process.env.PUSHOVER_TOKEN || '',
    });
    return bridge.notifierInstance;
  }

  function notifyStatusText() {
    const provider = (process.env.NOTIFY_PROVIDER || 'ntfy').toLowerCase();
    const hasTopic = provider === 'ntfy' ? Boolean(process.env.NTFY_TOPIC) : (provider === 'pushover' ? Boolean(process.env.PUSHOVER_USER && process.env.PUSHOVER_TOKEN) : true);
    const mode = bridge.notifyUserOptIn ? 'always' : 'empty-channel only';
    const config = hasTopic ? 'configured' : 'NOT configured';
    return `notify: ${mode} via ${provider} (${config}). Threshold: ${process.env.NOTIFY_MIN_TASK_MS || '60000'}ms.`;
  }

  async function getVoiceChannelHumanCount() {
    if (!bridge.activeVoiceChannelId) return 0;
    try {
      const ch = await client.channels.fetch(bridge.activeVoiceChannelId).catch(() => null);
      if (!ch || !ch.members) return 0;
      let count = 0;
      for (const [, m] of ch.members) if (!m.user?.bot) count += 1;
      return count;
    } catch (e) {
      warn('humanCount failed', e?.message || e);
      return 0;
    }
  }

  async function maybeNotifyTaskComplete({ answer, label, elapsedMs, guildId }) {
    const provider = (process.env.NOTIFY_PROVIDER || '').toLowerCase();
    if (!provider || provider === 'noop') return;
    const minTaskMs = Number(process.env.NOTIFY_MIN_TASK_MS || '60000');
    const debounceMs = Number(process.env.NOTIFY_DEBOUNCE_MS || '30000');
    const humanCount = await getVoiceChannelHumanCount();
    const notifier = ensureNotifier();
    if (!notifier.shouldNotify({ humanCount, taskMs: elapsedMs, minTaskMs, userOptIn: bridge.notifyUserOptIn })) return;
    const text = String(answer || '').trim();
    const lastSentence = text.split(/(?<=[.!?。！？])\s+/).filter(Boolean).pop() || text;
    const body = lastSentence.slice(0, 200);
    const now = Date.now();
    if (body && body === bridge.lastNotifyBody && now - bridge.lastNotifyAt < debounceMs) {
      log('notify debounced', 'sinceLastMs', now - bridge.lastNotifyAt);
      return;
    }
    const title = label ? `${label} finished` : 'VerbalCoding finished';
    const deepLink = buildDiscordDeepLink({ guildId, channelId: bridge.activeVoiceChannelId });
    try {
      const result = await notifier.send({ title, body, deepLink });
      bridge.lastNotifyAt = now;
      bridge.lastNotifyBody = body;
      log('notify sent', 'provider', provider, 'status', result?.status || result?.ok, 'skipped', result?.skipped || false);
    } catch (e) {
      warn('notify send failed', e?.message || e);
    }
  }

  return {
    ensureNotifier,
    notifyStatusText,
    getVoiceChannelHumanCount,
    maybeNotifyTaskComplete,
  };
}
