export function shouldRouteDiscordTextToAgent({ content = '', channelId = '', transcriptChannelId = '' } = {}) {
  const text = String(content || '').trim();
  if (!text) return false;
  if (text.startsWith('!')) return false;
  const target = String(transcriptChannelId || '').trim();
  if (!target) return true;
  return String(channelId || '') === target;
}

export function appendRecentDiscordText(state, { channelId = '', authorLabel = 'user', content = '', now = Date.now(), maxEntries = 12 } = {}) {
  const id = String(channelId || '').trim();
  const text = String(content || '').trim();
  if (!id || !text || text.startsWith('!')) return;
  const entries = state.get(id) || [];
  entries.push({ at: Number(now) || Date.now(), authorLabel: String(authorLabel || 'user'), content: text.slice(0, 500) });
  state.set(id, entries.slice(-maxEntries));
}

export function formatRecentDiscordContext(state, { channelId = '', now = Date.now(), maxAgeMs = 10 * 60 * 1000, maxEntries = 6 } = {}) {
  const id = String(channelId || '').trim();
  if (!id) return '';
  const cutoff = (Number(now) || Date.now()) - maxAgeMs;
  const entries = (state.get(id) || [])
    .filter(entry => Number(entry.at) >= cutoff)
    .slice(-maxEntries);
  if (!entries.length) return '';
  return ['최근 텍스트 채널 메시지:', ...entries.map(entry => `- ${entry.authorLabel}: ${entry.content}`)].join('\n');
}
