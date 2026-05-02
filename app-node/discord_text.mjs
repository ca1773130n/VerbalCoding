export function splitDiscordMessage(text, maxLength = 1900) {
  const body = String(text || '');
  if (!body.length) return [''];
  const chunks = [];
  for (let i = 0; i < body.length; i += maxLength) chunks.push(body.slice(i, i + maxLength));
  return chunks;
}

export async function sendDiscordText({ client, channelId, text, log = () => {}, warn = () => {} }) {
  const body = String(text || '');
  if (!channelId) {
    warn('sendText missing transcript channel id; text not delivered', body.slice(0, 200));
    return false;
  }
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased?.()) {
      warn('sendText target is not text based', channelId);
      return false;
    }
    const chunks = splitDiscordMessage(body);
    for (const chunk of chunks) await ch.send(chunk);
    log('sendText delivered', 'chars', body.length, 'chunks', chunks.length);
    return true;
  } catch (e) {
    warn('sendText failed', e?.stack || e);
    return false;
  }
}
