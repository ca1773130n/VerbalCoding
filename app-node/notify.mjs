const SECRET_RE = /\b(?:token|api[_-]?key|password|secret|authorization|bearer)\b\s*[:=]?\s*\S+/gi;
const SK_RE = /\bsk-[a-zA-Z0-9_-]{8,}\b/g;
const NTFY_BASE_DEFAULT = 'https://ntfy.sh';

function redact(text) {
  return String(text || '')
    .replace(SECRET_RE, '$& [REDACTED]')
    .replace(/(\[REDACTED\]\s*)+/g, '[REDACTED] ')
    .replace(SK_RE, '[REDACTED]');
}

export function buildDiscordDeepLink({ guildId, channelId } = {}) {
  if (!guildId || !channelId) return '';
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function createNotifier({
  provider = 'ntfy',
  topic = '',
  fetchImpl = globalThis.fetch,
  ntfyBase = NTFY_BASE_DEFAULT,
  pushoverUser = '',
  pushoverToken = '',
} = {}) {
  async function sendNtfy({ title, body, deepLink }) {
    if (!topic) return { skipped: true, reason: 'no topic' };
    const headers = { Title: title };
    if (deepLink) headers.Click = deepLink;
    const res = await fetchImpl(`${ntfyBase}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body,
    });
    return { ok: !!res?.ok, status: res?.status };
  }

  async function sendPushover({ title, body, deepLink }) {
    if (!pushoverUser || !pushoverToken) return { skipped: true, reason: 'no pushover creds' };
    const payload = {
      user: pushoverUser,
      token: pushoverToken,
      title,
      message: body,
    };
    if (deepLink) {
      payload.url = deepLink;
      payload.url_title = 'Open Discord';
    }
    const res = await fetchImpl('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: !!res?.ok, status: res?.status };
  }

  async function send({ title = 'VerbalCoding', body = '', deepLink = '' } = {}) {
    const safeBody = redact(body).slice(0, 200);
    const safeTitle = redact(title).slice(0, 80);
    if (provider === 'ntfy') return sendNtfy({ title: safeTitle, body: safeBody, deepLink });
    if (provider === 'pushover') return sendPushover({ title: safeTitle, body: safeBody, deepLink });
    if (provider === 'noop') return { ok: true };
    throw new Error(`unknown notify provider ${provider}`);
  }

  function shouldNotify({ humanCount = 0, taskMs = 0, minTaskMs = 60_000, userOptIn = false } = {}) {
    if (taskMs < minTaskMs) return false;
    if (userOptIn) return true;
    return humanCount === 0;
  }

  return { send, shouldNotify };
}
