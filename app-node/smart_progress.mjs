import { EventEmitter } from 'node:events';

const DEFAULT_BASE = 'https://api.groq.com/openai/v1';

export function createSmartProgressSummarizer({
  apiKey = '',
  baseUrl = DEFAULT_BASE,
  model = 'llama-3.1-8b-instant',
  windowMs = 4000,
  language = 'en',
  fetchImpl = globalThis.fetch,
  timeoutMs = 1500,
  cacheMs = 60_000,
  maxBatch = 8,
} = {}) {
  const ee = new EventEmitter();
  let buffer = [];
  let timer = null;
  const cache = new Map();

  function emitRaw(events) {
    for (const e of events) ee.emit('summary', e);
  }

  async function summarize(events) {
    const key = events.join('|');
    const cached = cache.get(key);
    if (cached && Date.now() - cached.t < cacheMs) return cached.text;
    const ctl = new AbortController();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        try { ctl.abort(); } catch {}
        reject(new Error('smart_progress timeout'));
      }, timeoutMs);
    });
    const sysLang = language === 'ko' ? 'Korean' : 'English';
    const requestPromise = (async () => {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        signal: ctl.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 40,
          messages: [
            { role: 'system', content: `Summarize a coding agent's recent actions in one short ${sysLang} sentence. No file paths unless essential. No quotes.` },
            { role: 'user', content: events.join('\n') },
          ],
        }),
      });
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content || '').trim();
    })();
    try {
      const text = await Promise.race([requestPromise, timeoutPromise]);
      if (text) cache.set(key, { text, t: Date.now() });
      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function flush() {
    timer = null;
    const events = buffer;
    buffer = [];
    if (!events.length) return;
    if (!apiKey || typeof fetchImpl !== 'function') {
      emitRaw(events);
      return;
    }
    summarize(events)
      .then(text => ee.emit('summary', text || events[events.length - 1]))
      .catch(() => emitRaw(events));
  }

  return {
    on: (event, fn) => ee.on(event, fn),
    ingest(event) {
      const e = String(event || '').trim();
      if (!e) return;
      buffer.push(e);
      if (buffer.length >= maxBatch) {
        if (timer) { clearTimeout(timer); timer = null; }
        flush();
        return;
      }
      if (!timer) timer = setTimeout(flush, windowMs);
    },
    setLanguage(lang) { language = lang; },
  };
}
