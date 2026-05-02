export function shouldRouteDiscordTextToAgent({ content = '', channelId = '', transcriptChannelId = '' } = {}) {
  const text = String(content || '').trim();
  if (!text) return false;
  if (text.startsWith('!')) return false;
  const target = String(transcriptChannelId || '').trim();
  if (!target) return true;
  return String(channelId || '') === target;
}
